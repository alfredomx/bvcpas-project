import { Injectable } from '@nestjs/common'
import { EventLogService } from '../../95-event-log/event-log.service'
import { TransactionNotFoundInSnapshotError } from '../customer-support.errors'
import { ClientTransactionsRepository } from '../transactions/client-transactions.repository'
import { ClientTransactionResponsesRepository } from './client-transaction-responses.repository'
import type { ClientTransactionResponse } from '../../../db/schema/client-transaction-responses'

export interface SaveResponseInput {
  clientId: string
  realmId: string
  qboTxnType: string
  qboTxnId: string
  note: string
}

/**
 * Service para respuestas del cliente. Modelo de UNA respuesta por transacción
 * (UPSERT en el repo). Si el cliente edita después, se refresca el snapshot
 * inline + actualiza la nota.
 *
 * Antes de guardar, valida que la transacción exista en `client_transactions`
 * (snapshot actual). Si el cliente intenta responder a algo que ya no está,
 * lanza `TransactionNotFoundInSnapshotError` (404).
 */
@Injectable()
export class ClientTransactionResponsesService {
  constructor(
    private readonly responsesRepo: ClientTransactionResponsesRepository,
    private readonly txnRepo: ClientTransactionsRepository,
    private readonly events: EventLogService,
  ) {}

  async saveResponse(input: SaveResponseInput): Promise<ClientTransactionResponse> {
    const txn = await this.txnRepo.findOne(input.realmId, input.qboTxnType, input.qboTxnId)
    if (!txn) throw new TransactionNotFoundInSnapshotError(input.qboTxnId)

    const existed = await this.responsesRepo.findByTxn(
      input.clientId,
      input.realmId,
      input.qboTxnType,
      input.qboTxnId,
    )

    const saved = await this.responsesRepo.upsert({
      clientId: input.clientId,
      realmId: input.realmId,
      qboTxnType: input.qboTxnType,
      qboTxnId: input.qboTxnId,
      txnDate: txn.txnDate,
      vendorName: txn.vendorName,
      memo: txn.memo,
      splitAccount: txn.splitAccount,
      category: txn.category,
      amount: txn.amount,
      clientNote: input.note,
    })

    await this.events.log(
      'client_transaction_response.saved',
      {
        clientId: input.clientId,
        qboTxnId: input.qboTxnId,
        qboTxnType: input.qboTxnType,
        isUpdate: existed !== null,
      },
      undefined,
      { type: 'client', id: input.clientId },
    )

    return saved
  }

  async listForClient(clientId: string): Promise<ClientTransactionResponse[]> {
    return this.responsesRepo.listByClient(clientId)
  }
}
