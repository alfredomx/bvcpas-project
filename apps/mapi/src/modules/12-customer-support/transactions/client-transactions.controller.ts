import {
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
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe'
import { Roles } from '../../../core/auth/decorators/roles.decorator'
import type { Client } from '../../../db/schema/clients'
import type { ClientTransaction } from '../../../db/schema/client-transactions'
import { ClientsRepository } from '../../11-clients/clients.repository'
import { ClientNotFoundError } from '../../20-intuit-oauth/intuit-oauth.errors'
import {
  ListTransactionsQueryDto,
  ListTransactionsQuerySchema,
  SyncResultDto,
  SyncTransactionsQueryDto,
  SyncTransactionsQuerySchema,
  TransactionDto,
  TransactionsListResponseDto,
} from '../dto/customer-support.dto'
import { ClientTransactionsRepository } from './client-transactions.repository'
import { TransactionsSyncService } from './transactions-sync.service'

function serializeTxn(t: ClientTransaction): TransactionDto {
  return {
    realm_id: t.realmId,
    qbo_txn_type: t.qboTxnType,
    qbo_txn_id: t.qboTxnId,
    client_id: t.clientId,
    txn_date: t.txnDate,
    docnum: t.docnum,
    vendor_name: t.vendorName,
    memo: t.memo,
    split_account: t.splitAccount,
    category: t.category,
    amount: t.amount,
    synced_at: t.syncedAt.toISOString(),
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

@ApiTags('Customer Support')
@ApiBearerAuth('bearer')
@Controller('clients/:id/transactions')
@Roles('admin')
export class ClientTransactionsController {
  constructor(
    private readonly syncService: TransactionsSyncService,
    private readonly txnRepo: ClientTransactionsRepository,
    private readonly clientsRepo: ClientsRepository,
  ) {}

  @Post('sync')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '/v1/clients/:id/transactions/sync',
    description:
      'Pulla TransactionList de Intuit y reescribe el snapshot dentro del rango. Borrón total + INSERT.',
  })
  @ApiResponse({ status: 200, type: SyncResultDto })
  @ApiResponse({ status: 400, description: 'Cliente sin QBO conectado' })
  async sync(
    @Param('id', ParseUUIDPipe) clientId: string,
    @Query(new ZodValidationPipe(SyncTransactionsQuerySchema)) query: SyncTransactionsQueryDto,
  ): Promise<SyncResultDto> {
    const result = await this.syncService.syncFromQbo(clientId, query.startDate, query.endDate)
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
    summary: '/v1/clients/:id/transactions',
    description:
      'Listado de transacciones del snapshot actual. Filtros opcionales: category, filter (all/income/expense), startDate/endDate.',
  })
  @ApiResponse({ status: 200, type: TransactionsListResponseDto })
  async list(
    @Param('id', ParseUUIDPipe) clientId: string,
    @Query(new ZodValidationPipe(ListTransactionsQuerySchema)) query: ListTransactionsQueryDto,
  ): Promise<TransactionsListResponseDto> {
    const client = await this.clientsRepo.findById(clientId)
    if (!client) throw new ClientNotFoundError(clientId)

    const items = await this.txnRepo.list({
      clientId,
      ...(query.category ? { category: query.category } : {}),
      ...(query.startDate ? { startDate: query.startDate } : {}),
      ...(query.endDate ? { endDate: query.endDate } : {}),
    })
    const filtered = applyClientFilter(items, client.transactionsFilter, query.filter)
    return {
      items: filtered.map(serializeTxn),
      total: filtered.length,
    }
  }

  @Delete(':qboTxnType/:qboTxnId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: '/v1/clients/:id/transactions/:qboTxnType/:qboTxnId',
    description:
      'Borra una transacción individual del snapshot. La respuesta del cliente (si la había) se preserva en client_transaction_responses.',
  })
  @ApiResponse({ status: 204, description: 'Transacción borrada' })
  @ApiResponse({ status: 404, description: 'Transacción no encontrada' })
  async deleteOne(
    @Param('id', ParseUUIDPipe) clientId: string,
    @Param('qboTxnType') qboTxnType: string,
    @Param('qboTxnId') qboTxnId: string,
  ): Promise<void> {
    const client = await this.clientsRepo.findById(clientId)
    if (!client) throw new ClientNotFoundError(clientId)
    if (!client.qboRealmId) throw new ClientNotFoundError(clientId)

    const removed = await this.txnRepo.deleteOne(client.qboRealmId, qboTxnType, qboTxnId)
    if (!removed) throw new NotFoundException('Transacción no encontrada')
  }
}
