import { Injectable } from '@nestjs/common'
import { EventLogService } from '../../95-event-log/event-log.service'
import {
  QboAccountIdRequiredError,
  TransactionNotFoundInSnapshotError,
} from '../customer-support.errors'
import { ClientPeriodFollowupsRepository } from '../followups/client-period-followups.repository'
import { ClientTransactionsRepository } from '../transactions/client-transactions.repository'
import { ClientTransactionResponsesRepository } from './client-transaction-responses.repository'
import { QboWritebackService } from './qbo-writeback.service'
import type { ClientTransactionResponse } from '../../../db/schema/client-transaction-responses'

/** Deriva el período 'YYYY-MM' de una txn_date (formato 'YYYY-MM-DD'). */
function deriveFollowupPeriod(txnDate: string): string {
  return txnDate.slice(0, 7)
}

export interface SaveResponseInput {
  txnId: string // id UUID interno de client_transactions
  note: string
  /** Sufijo opcional concatenado a `note` solo en el writeback a QBO.
   * NO se concatena al `clientNote` que se guarda en mapi. */
  appendedText?: string | null
  qboAccountId?: string | null
  completed?: boolean
  /** Si true, además del upsert local hace writeback a QBO. Requiere
   * qboAccountId no-null y un `userId` válido para resolver tokens. */
  qboSync?: boolean
  userId?: string
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
    private readonly followupsRepo: ClientPeriodFollowupsRepository,
    private readonly events: EventLogService,
    private readonly writeback: QboWritebackService,
  ) {}

  async saveResponse(input: SaveResponseInput): Promise<ClientTransactionResponse> {
    const txn = await this.txnRepo.findById(input.txnId)
    if (!txn) throw new TransactionNotFoundInSnapshotError(input.txnId)

    if (input.qboSync && !input.qboAccountId) {
      // Sin cuenta no hay writeback posible. Falla rápido antes de tocar DB.
      throw new QboAccountIdRequiredError()
    }

    // includeDeleted: si el response existía pero estaba soft-deleted, el
    // upsert lo va a reactivar (resetea deleted_at). Para reportar isUpdate
    // correctamente debemos verlo aquí.
    const existed = await this.responsesRepo.findByTxn(
      txn.clientId,
      txn.realmId,
      txn.qboTxnType,
      txn.qboTxnId,
      { includeDeleted: true },
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
      appendedText: input.appendedText ?? null,
      qboAccountId: input.qboAccountId ?? null,
      completed: input.completed ?? false,
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

    // Si después del save el cliente llegó al 100% en el período de la
    // transacción, marcar last_fully_responded_at (v0.13.0).
    await this.followupsRepo.maybeMarkFullyResponded(
      txn.clientId,
      deriveFollowupPeriod(txn.txnDate),
    )

    if (input.qboSync && input.qboAccountId && input.userId) {
      // Si el writeback falla, NO hacemos rollback del response. La nota
      // queda guardada para que el admin pueda reintentar sin reescribir.
      const trimmedAppend = input.appendedText?.trim() ?? ''
      const qboNote = trimmedAppend ? `${input.note} ${trimmedAppend}` : input.note

      await this.writeback.writeback({
        realmId: txn.realmId,
        clientId: txn.clientId,
        userId: input.userId,
        qboTxnType: txn.qboTxnType,
        qboTxnId: txn.qboTxnId,
        qboAccountId: input.qboAccountId,
        note: qboNote,
      })

      const synced = await this.responsesRepo.markSyncedToQbo(saved.id)

      await this.events.log(
        'client_transaction_response.qbo_synced',
        {
          clientId: txn.clientId,
          qboTxnId: txn.qboTxnId,
          qboTxnType: txn.qboTxnType,
          qboAccountId: input.qboAccountId,
        },
        input.userId,
        { type: 'client', id: txn.clientId },
      )

      return synced ?? saved
    }

    return saved
  }

  async listForClient(clientId: string): Promise<ClientTransactionResponse[]> {
    return this.responsesRepo.listByClient(clientId)
  }

  /** Soft-delete del response asociado a una transacción. Devuelve null si
   * la transacción no tiene response o ya estaba borrado. */
  async softDeleteByTxnId(txnId: string): Promise<ClientTransactionResponse | null> {
    const txn = await this.txnRepo.findById(txnId)
    if (!txn) throw new TransactionNotFoundInSnapshotError(txnId)

    const deleted = await this.responsesRepo.softDeleteByTxn(
      txn.clientId,
      txn.realmId,
      txn.qboTxnType,
      txn.qboTxnId,
    )

    if (deleted) {
      await this.events.log(
        'client_transaction_response.deleted',
        {
          clientId: txn.clientId,
          qboTxnId: txn.qboTxnId,
          qboTxnType: txn.qboTxnType,
        },
        undefined,
        { type: 'client', id: txn.clientId },
      )

      // v0.13.0: idempotente; si por algún edge case quedó al 100%
      // (ej: tx huérfana), marca. Si no, no hace nada.
      await this.followupsRepo.maybeMarkFullyResponded(
        txn.clientId,
        deriveFollowupPeriod(txn.txnDate),
      )
    }

    return deleted
  }
}
