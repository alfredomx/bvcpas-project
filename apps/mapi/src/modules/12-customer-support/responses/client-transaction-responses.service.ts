import { Injectable } from '@nestjs/common'
import { EventLogService } from '../../95-event-log/event-log.service'
import { TransactionNotFoundInSnapshotError } from '../customer-support.errors'
import { ClientTransactionsRepository } from '../transactions/client-transactions.repository'
import { ClientTransactionResponsesRepository } from './client-transaction-responses.repository'
import type { ClientTransactionResponse } from '../../../db/schema/client-transaction-responses'

export interface SaveResponseInput {
  txnId: string // id UUID interno de client_transactions
  note: string
}

/**
 * Service para respuestas del cliente. Modelo de UNA respuesta por transacción
 * (UPSERT en el repo). Si el cliente edita después, se refresca el snapshot
 * inline + actualiza la nota.
 *
 * `saveResponse` recibe el id UUID interno de la transacción (txnId), busca
 * la fila en `client_transactions` y de ahí saca clientId/realmId/qboTxnType/
 * qboTxnId. Si la transacción ya no existe en el snapshot (porque se hizo un
 * sync nuevo y desapareció), lanza `TransactionNotFoundInSnapshotError` (404).
 */
@Injectable()
export class ClientTransactionResponsesService {
  constructor(
    private readonly responsesRepo: ClientTransactionResponsesRepository,
    private readonly txnRepo: ClientTransactionsRepository,
    private readonly events: EventLogService,
  ) {}

  async saveResponse(input: SaveResponseInput): Promise<ClientTransactionResponse> {
    const txn = await this.txnRepo.findById(input.txnId)
    if (!txn) throw new TransactionNotFoundInSnapshotError(input.txnId)

    const existed = await this.responsesRepo.findByTxn(
      txn.clientId,
      txn.realmId,
      txn.qboTxnType,
      txn.qboTxnId,
    )

    const saved = await this.responsesRepo.upsert({
      clientId: txn.clientId,
      realmId: txn.realmId,
      qboTxnType: txn.qboTxnType,
      qboTxnId: txn.qboTxnId,
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
        clientId: txn.clientId,
        qboTxnId: txn.qboTxnId,
        qboTxnType: txn.qboTxnType,
        isUpdate: existed !== null,
      },
      undefined,
      { type: 'client', id: txn.clientId },
    )

    return saved
  }

  async listForClient(clientId: string): Promise<ClientTransactionResponse[]> {
    return this.responsesRepo.listByClient(clientId)
  }
}
