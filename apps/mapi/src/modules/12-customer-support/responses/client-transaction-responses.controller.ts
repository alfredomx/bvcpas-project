import { Controller, Get, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe'
import { Roles } from '../../../core/auth/decorators/roles.decorator'
import type { ClientTransactionResponse } from '../../../db/schema/client-transaction-responses'
import {
  ClientIdQueryDto,
  ClientIdQuerySchema,
  TransactionResponseDto,
  TransactionResponsesListDto,
} from '../dto/customer-support.dto'
import { ClientTransactionResponsesService } from './client-transaction-responses.service'

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
    responded_at: r.respondedAt.toISOString(),
    synced_to_qbo_at: r.syncedToQboAt ? r.syncedToQboAt.toISOString() : null,
  }
}

@ApiTags('Transactions')
@ApiBearerAuth('bearer')
@Controller('transactions/responses')
@Roles('admin')
export class ClientTransactionResponsesController {
  constructor(private readonly service: ClientTransactionResponsesService) {}

  @Get()
  @ApiOperation({
    summary: '/v1/transactions/responses',
    description:
      'Listado de respuestas del cliente. Persistente — incluye respuestas históricas que ya no aparecen en el snapshot actual. Requiere `?clientId=`.',
  })
  @ApiResponse({ status: 200, type: TransactionResponsesListDto })
  async list(
    @Query(new ZodValidationPipe(ClientIdQuerySchema)) query: ClientIdQueryDto,
  ): Promise<TransactionResponsesListDto> {
    const items = await this.service.listForClient(query.clientId)
    return { items: items.map(serializeResp) }
  }
}
