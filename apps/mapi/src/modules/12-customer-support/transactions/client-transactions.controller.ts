import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe'
import { CurrentUser } from '../../../core/auth/decorators/current-user.decorator'
import { ClientAccessGuard } from '../../../core/auth/guards/client-access.guard'
import { Roles } from '../../../core/auth/decorators/roles.decorator'
import type { SessionContext } from '../../../core/auth/sessions.service'
import type { Client } from '../../../db/schema/clients'
import type { ClientTransaction } from '../../../db/schema/client-transactions'
import type { ClientTransactionResponse } from '../../../db/schema/client-transaction-responses'
import { ClientsRepository } from '../../11-clients/clients.repository'
import { ClientNotFoundError } from '../../11-clients/clients.errors'
import {
  ListTransactionsQueryDto,
  ListTransactionsQuerySchema,
  SyncResultDto,
  SyncTransactionsBodyDto,
  SyncTransactionsBodySchema,
  TransactionDto,
  TransactionsListResponseDto,
} from '../dto/customer-support.dto'
import { ClientTransactionsRepository } from './client-transactions.repository'
import { TransactionsSyncService } from './transactions-sync.service'
import { ClientTransactionResponsesRepository } from '../responses/client-transaction-responses.repository'

function serializeTxn(
  t: ClientTransaction,
  response?: ClientTransactionResponse | null,
): TransactionDto {
  return {
    id: t.id,
    realm_id: t.realmId,
    qbo_txn_type: t.qboTxnType,
    qbo_txn_id: t.qboTxnId,
    client_id: t.clientId,
    txn_date: t.txnDate,
    docnum: t.docnum,
    vendor_name: t.vendorName,
    memo: t.memo,
    split_account: t.splitAccount,
    qbo_account_id: t.qboAccountId ?? null,
    category: t.category,
    amount: t.amount,
    synced_at: t.syncedAt.toISOString(),
    response: response
      ? {
          client_note: response.clientNote,
          appended_text: response.appendedText ?? null,
          qbo_account_id: response.qboAccountId ?? null,
          completed: response.completed,
          responded_at: response.respondedAt.toISOString(),
          synced_to_qbo_at: response.syncedToQboAt ? response.syncedToQboAt.toISOString() : null,
        }
      : null,
  }
}

function applyClientFilter(
  items: ClientTransaction[],
  clientFilter: Client['transactionsFilter'],
  explicitFilter?: Client['transactionsFilter'],
): ClientTransaction[] {
  const effective = explicitFilter ?? clientFilter
  if (effective === 'all') return items
  if (effective === 'expense') {
    return items.filter((t) => t.category !== 'uncategorized_income')
  }
  if (effective === 'income') {
    return items.filter((t) => t.category !== 'uncategorized_expense')
  }
  return items
}

@ApiTags('Clients - Transactions')
@ApiBearerAuth('bearer')
@Controller('clients/:id/transactions')
@Roles('admin')
@UseGuards(ClientAccessGuard)
export class ClientTransactionsController {
  constructor(
    private readonly syncService: TransactionsSyncService,
    private readonly txnRepo: ClientTransactionsRepository,
    private readonly clientsRepo: ClientsRepository,
    private readonly responsesRepo: ClientTransactionResponsesRepository,
  ) {}

  @Post('sync')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'POST /v1/clients/:id/transactions/sync',
    description:
      'Pulla TransactionList de Intuit para el cliente y reescribe el snapshot dentro del rango. Borrón total + INSERT.',
  })
  @ApiResponse({ status: 200, type: SyncResultDto })
  @ApiResponse({ status: 400, description: 'Cliente sin QBO conectado' })
  async sync(
    @Param('id', ParseUUIDPipe) clientId: string,
    @Body(new ZodValidationPipe(SyncTransactionsBodySchema)) body: SyncTransactionsBodyDto,
    @CurrentUser() user: SessionContext,
  ): Promise<SyncResultDto> {
    const result = await this.syncService.syncFromQbo(
      clientId,
      body.startDate,
      body.endDate,
      user.userId,
    )
    return {
      client_id: result.clientId,
      start_date: result.startDate,
      end_date: result.endDate,
      deleted_count: result.deletedCount,
      inserted_count: result.insertedCount,
      duration_ms: result.durationMs,
    }
  }

  @Get()
  @ApiOperation({
    summary: 'GET /v1/clients/:id/transactions',
    description:
      'Listado de transacciones del snapshot del cliente. Filtros opcionales: category, filter (all/income/expense), startDate/endDate.',
  })
  @ApiResponse({ status: 200, type: TransactionsListResponseDto })
  async list(
    @Param('id', ParseUUIDPipe) clientId: string,
    @Query(new ZodValidationPipe(ListTransactionsQuerySchema)) query: ListTransactionsQueryDto,
  ): Promise<TransactionsListResponseDto> {
    const client = await this.clientsRepo.findById(clientId)
    if (!client) throw new ClientNotFoundError(clientId)

    const [items, responses] = await Promise.all([
      this.txnRepo.list({
        clientId,
        ...(query.category ? { category: query.category } : {}),
        ...(query.startDate ? { startDate: query.startDate } : {}),
        ...(query.endDate ? { endDate: query.endDate } : {}),
      }),
      this.responsesRepo.listByClient(clientId),
    ])

    // Índice de responses por qboTxnType:qboTxnId para join en memoria
    const responseIndex = new Map<string, ClientTransactionResponse>()
    for (const r of responses) {
      responseIndex.set(`${r.qboTxnType}:${r.qboTxnId}`, r)
    }

    // Si el admin pidió una category explícita, respeta su intención y NO
    // apliques transactions_filter del cliente (que excluiría income/expense
    // según config del cliente). El filtro del cliente solo aplica cuando el
    // caller no especificó category.
    let filtered = query.category
      ? items
      : applyClientFilter(items, client.transactionsFilter, query.filter)

    // Filtro por qbo_txn_id exacto si se especifica
    if (query.qboTxnId) {
      filtered = filtered.filter((t) => t.qboTxnId === query.qboTxnId)
    }

    return {
      items: filtered.map((t) =>
        serializeTxn(t, responseIndex.get(`${t.qboTxnType}:${t.qboTxnId}`)),
      ),
      total: filtered.length,
    }
  }

  @Delete(':txId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'DELETE /v1/clients/:id/transactions/:txId',
    description:
      'Borra una transacción individual del snapshot por su id UUID. La respuesta del cliente (si la había) se preserva en client_transaction_responses.',
  })
  @ApiResponse({ status: 204, description: 'Transacción borrada' })
  @ApiResponse({ status: 404, description: 'Transacción no encontrada' })
  async deleteOne(
    @Param('id', ParseUUIDPipe) _clientId: string,
    @Param('txId', ParseUUIDPipe) txId: string,
  ): Promise<void> {
    const removed = await this.txnRepo.deleteById(txId)
    if (!removed) throw new NotFoundException('Transacción no encontrada')
  }
}
