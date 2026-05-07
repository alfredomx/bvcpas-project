import { Body, Controller, Get, Param, ParseUUIDPipe, Patch } from '@nestjs/common'
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { Public } from '../../../common/decorators/public.decorator'
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe'
import { ClientsRepository } from '../../11-clients/clients.repository'
import {
  PublicTransactionDto,
  PublicTransactionsResponseDto,
  SaveNoteBodyDto,
  SaveNoteBodySchema,
  TransactionResponseDto,
} from '../dto/customer-support.dto'
import { ClientPublicLinksService } from '../public-links/client-public-links.service'
import { ClientTransactionResponsesService } from '../responses/client-transaction-responses.service'
import { ClientTransactionsRepository } from '../transactions/client-transactions.repository'
import { ClientNotFoundError } from '../../11-clients/clients.errors'
import {
  PublicLinkInvalidError,
  TransactionNotFoundInSnapshotError,
} from '../customer-support.errors'
import type { Client, ClientTransactionsFilter } from '../../../db/schema/clients'
import type { ClientTransaction } from '../../../db/schema/client-transactions'
import type { ClientTransactionResponse } from '../../../db/schema/client-transaction-responses'

function applyFilter(
  items: ClientTransaction[],
  filter: ClientTransactionsFilter,
): ClientTransaction[] {
  // Pública: SIEMPRE excluye AMA.
  const noAma = items.filter((t) => t.category !== 'ask_my_accountant')
  if (filter === 'all') return noAma
  if (filter === 'expense') return noAma.filter((t) => t.category === 'uncategorized_expense')
  if (filter === 'income') return noAma.filter((t) => t.category === 'uncategorized_income')
  return noAma
}

function serializeForPublic(
  t: ClientTransaction,
  responseByTxnId: Map<string, ClientTransactionResponse>,
): PublicTransactionDto {
  const r = responseByTxnId.get(t.id)
  if (t.category === 'ask_my_accountant') {
    throw new Error('AMA no debería llegar al endpoint público')
  }
  return {
    id: t.id,
    txn_date: t.txnDate,
    docnum: t.docnum,
    vendor_name: t.vendorName,
    memo: t.memo,
    split_account: t.splitAccount,
    category: t.category,
    amount: t.amount,
    client_note: r?.clientNote ?? null,
    responded_at: r?.respondedAt ? r.respondedAt.toISOString() : null,
  }
}

function clientPublicView(c: Client): PublicTransactionsResponseDto['client'] {
  return {
    id: c.id,
    legal_name: c.legalName,
    transactions_filter: c.transactionsFilter,
  }
}

function serializeResponse(r: ClientTransactionResponse): TransactionResponseDto {
  return {
    id: r.id,
    client_id: r.clientId,
    realm_id: r.realmId,
    qbo_txn_type: r.qboTxnType,
    qbo_txn_id: r.qboTxnId,
    txn_date: r.txnDate,
    vendor_name: r.vendorName,
    memo: r.memo,
    split_account: r.splitAccount,
    category: r.category,
    amount: r.amount,
    client_note: r.clientNote,
    responded_at: r.respondedAt.toISOString(),
    synced_to_qbo_at: r.syncedToQboAt ? r.syncedToQboAt.toISOString() : null,
  }
}

@ApiTags('Public')
@Controller('public/transactions')
export class PublicTransactionsController {
  constructor(
    private readonly linksService: ClientPublicLinksService,
    private readonly responsesService: ClientTransactionResponsesService,
    private readonly txnRepo: ClientTransactionsRepository,
    private readonly clientsRepo: ClientsRepository,
  ) {}

  @Public()
  @Get(':token')
  @ApiOperation({
    summary: '/v1/public/transactions/:token',
    description:
      'Endpoint público (sin JWT, autenticado por token) para que el cliente vea sus transacciones uncategorized. Excluye AMAs siempre. Aplica `transactions_filter` del cliente.',
  })
  @ApiResponse({ status: 200, type: PublicTransactionsResponseDto })
  @ApiResponse({ status: 404, description: 'Token inválido' })
  @ApiResponse({ status: 410, description: 'Token revocado o expirado' })
  async getTransactions(@Param('token') token: string): Promise<PublicTransactionsResponseDto> {
    const link = await this.linksService.validateToken(token, 'uncats')
    const client = await this.clientsRepo.findById(link.clientId)
    if (!client) throw new ClientNotFoundError(link.clientId)

    const items = await this.txnRepo.list({ clientId: client.id })
    const filtered = applyFilter(items, client.transactionsFilter)

    // Indexar respuestas por id de transacción del snapshot. Si una respuesta
    // existe pero ya no está en snapshot, no aparece en la vista pública.
    const responses = await this.responsesService.listForClient(client.id)
    const responseByTxnId = new Map<string, ClientTransactionResponse>()
    const responsesByQboNaturalKey = new Map<string, ClientTransactionResponse>()
    for (const r of responses) {
      responsesByQboNaturalKey.set(`${r.qboTxnType}:${r.qboTxnId}`, r)
    }
    for (const t of filtered) {
      const r = responsesByQboNaturalKey.get(`${t.qboTxnType}:${t.qboTxnId}`)
      if (r) responseByTxnId.set(t.id, r)
    }

    return {
      client: clientPublicView(client),
      items: filtered.map((t) => serializeForPublic(t, responseByTxnId)),
    }
  }

  @Public()
  @Patch(':token/:txnId')
  @ApiOperation({
    summary: '/v1/public/transactions/:token/:txnId',
    description:
      'El cliente guarda su nota para una transacción. UPSERT — si ya respondió antes, edita. `:txnId` es el id UUID interno de la transacción.',
  })
  @ApiResponse({ status: 200, type: TransactionResponseDto })
  @ApiResponse({ status: 404, description: 'Transacción no existe en snapshot actual' })
  @ApiResponse({ status: 410, description: 'Token revocado o expirado' })
  async saveNote(
    @Param('token') token: string,
    @Param('txnId', ParseUUIDPipe) txnId: string,
    @Body(new ZodValidationPipe(SaveNoteBodySchema)) body: SaveNoteBodyDto,
  ): Promise<TransactionResponseDto> {
    const link = await this.linksService.validateToken(token, 'uncats')

    // Resolvemos la transacción por su id UUID y verificamos que pertenezca
    // al cliente del token. Si no, tratamos como token invalid (no leak de
    // existencia de IDs).
    const txn = await this.txnRepo.findById(txnId)
    if (!txn) throw new TransactionNotFoundInSnapshotError(txnId)
    if (txn.clientId !== link.clientId) throw new PublicLinkInvalidError()

    // AMAs no se pueden editar desde el endpoint público.
    if (txn.category === 'ask_my_accountant') {
      throw new TransactionNotFoundInSnapshotError(txnId)
    }

    const saved = await this.responsesService.saveResponse({
      txnId,
      note: body.note,
    })
    return serializeResponse(saved)
  }
}
