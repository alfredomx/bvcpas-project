import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { ClientAccessGuard } from '../../../core/auth/guards/client-access.guard'
import { Roles } from '../../../core/auth/decorators/roles.decorator'
import type { ClientTransactionResponse } from '../../../db/schema/client-transaction-responses'
import { TransactionResponseDto, TransactionResponsesListDto } from '../dto/customer-support.dto'
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

@ApiTags('Clients')
@ApiBearerAuth('bearer')
@Controller('clients/:id/transactions/responses')
@Roles('admin')
@UseGuards(ClientAccessGuard)
export class ClientTransactionResponsesController {
  constructor(private readonly service: ClientTransactionResponsesService) {}

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
}
