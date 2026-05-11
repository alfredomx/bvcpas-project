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
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger'
import { ClientAccessGuard } from '../../../core/auth/guards/client-access.guard'
import { Roles } from '../../../core/auth/decorators/roles.decorator'
import { CurrentUser } from '../../../core/auth/decorators/current-user.decorator'
import type { SessionContext } from '../../../core/auth/sessions.service'
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe'
import type { ClientTransactionResponse } from '../../../db/schema/client-transaction-responses'
import {
  SaveNoteBodyDto,
  SaveNoteBodySchema,
  SaveNoteQueryDto,
  SaveNoteQuerySchema,
  TransactionResponseDto,
  TransactionResponsesListDto,
} from '../dto/customer-support.dto'
import { ClientTransactionResponsesService } from './client-transaction-responses.service'
import { ClientTransactionsRepository } from '../transactions/client-transactions.repository'
import { TransactionNotFoundInSnapshotError } from '../customer-support.errors'

function serializeResp(r: ClientTransactionResponse): TransactionResponseDto {
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
    appended_text: r.appendedText ?? null,
    qbo_account_id: r.qboAccountId ?? null,
    completed: r.completed,
    responded_at: r.respondedAt.toISOString(),
    synced_to_qbo_at: r.syncedToQboAt ? r.syncedToQboAt.toISOString() : null,
  }
}

@ApiTags('Clients - Responses')
@ApiBearerAuth('bearer')
@Controller('clients/:id/transactions/responses')
@Roles('admin')
@UseGuards(ClientAccessGuard)
export class ClientTransactionResponsesController {
  constructor(
    private readonly service: ClientTransactionResponsesService,
    private readonly txnRepo: ClientTransactionsRepository,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'GET /v1/clients/:id/transactions/responses',
    description:
      'Listado de respuestas del cliente. Persistente — incluye respuestas históricas que ya no aparecen en el snapshot actual.',
  })
  @ApiResponse({ status: 200, type: TransactionResponsesListDto })
  async list(@Param('id', ParseUUIDPipe) clientId: string): Promise<TransactionResponsesListDto> {
    const items = await this.service.listForClient(clientId)
    return { items: items.map(serializeResp) }
  }

  @Patch(':txnId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'PATCH /v1/clients/:id/transactions/responses/:txnId',
    description:
      'Admin guarda o edita la nota de una transacción en nombre del cliente. UPSERT — si ya existe respuesta, la actualiza.\n\n' +
      'Si se manda `?qbo_sync=true`, además del upsert local hace writeback a QBO: GET → mergea AccountRef + PrivateNote → POST update. ' +
      'Requiere `qbo_account_id` no-null. Solo soporta Purchase y Deposit en v1; otros tipos devuelven `TXN_TYPE_NOT_SUPPORTED`. ' +
      'Cuando el writeback tiene éxito, marca `synced_to_qbo_at` y fuerza `completed=true`. Si falla, el response queda guardado para reintentar.',
  })
  @ApiQuery({
    name: 'qbo_sync',
    required: false,
    description: 'true para sincronizar también a QBO al guardar.',
  })
  @ApiResponse({ status: 200, type: TransactionResponseDto })
  @ApiResponse({ status: 400, description: 'qbo_account_id requerido o tipo no soportado' })
  @ApiResponse({ status: 404, description: 'Transacción no encontrada en el snapshot' })
  @ApiResponse({ status: 409, description: 'SyncToken stale: la transacción cambió en QBO' })
  @ApiResponse({ status: 502, description: 'Error de Intuit API durante el writeback' })
  async saveNote(
    @Param('id', ParseUUIDPipe) clientId: string,
    @Param('txnId', ParseUUIDPipe) txnId: string,
    @Query(new ZodValidationPipe(SaveNoteQuerySchema)) query: SaveNoteQueryDto,
    @Body(new ZodValidationPipe(SaveNoteBodySchema)) body: SaveNoteBodyDto,
    @CurrentUser() user: SessionContext,
  ): Promise<TransactionResponseDto> {
    const txn = await this.txnRepo.findById(txnId)
    if (txn?.clientId !== clientId) throw new TransactionNotFoundInSnapshotError(txnId)

    const saved = await this.service.saveResponse({
      txnId,
      note: body.note,
      appendedText: body.appended_text ?? null,
      qboAccountId: body.qbo_account_id ?? null,
      completed: body.completed,
      qboSync: query.qbo_sync,
      userId: user.userId,
    })
    return serializeResp(saved)
  }

  @Delete(':txnId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'DELETE /v1/clients/:id/transactions/responses/:txnId',
    description:
      'Soft-delete del response asociado a una transacción. La fila se marca con `deleted_at` ' +
      'pero NO se borra. Si el cliente vuelve a guardar nota sobre esa transacción, el response ' +
      'se reactiva automáticamente (transparente para frontend). El listado público y el listado ' +
      'admin estándar ocultan responses borrados.',
  })
  @ApiResponse({ status: 204, description: 'Response borrado o ya estaba borrado' })
  @ApiResponse({ status: 404, description: 'Transacción no encontrada en el snapshot' })
  async softDelete(
    @Param('id', ParseUUIDPipe) clientId: string,
    @Param('txnId', ParseUUIDPipe) txnId: string,
  ): Promise<void> {
    const txn = await this.txnRepo.findById(txnId)
    if (txn?.clientId !== clientId) throw new TransactionNotFoundInSnapshotError(txnId)

    const deleted = await this.service.softDeleteByTxnId(txnId)
    if (!deleted) {
      // No había response, o ya estaba borrado. 404 explícito para que el
      // frontend sepa que no hay nada que borrar.
      throw new NotFoundException('No hay response activo para esta transacción')
    }
  }
}
