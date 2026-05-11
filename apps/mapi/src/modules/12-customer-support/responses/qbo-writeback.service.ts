import { Injectable, Logger } from '@nestjs/common'
import { IntuitApiService } from '../../20-intuit-oauth/api-client/intuit-api.service'
import { IntuitBadRequestError } from '../../20-intuit-oauth/intuit-oauth.errors'
import { QboStaleSyncTokenError, QboTxnTypeNotSupportedError } from '../customer-support.errors'

/**
 * Mapeo de `qbo_txn_type` (como viene en el reporte TransactionList) al tipo
 * V3 API real. QBO reporta "Expense", "Check", "Credit Card Expense" como
 * filas distintas pero todas son entidad V3 `Purchase`. Idem "Bank Deposit"
 * == `Deposit`.
 */
const TYPE_TO_V3: Record<string, 'Purchase' | 'Deposit'> = {
  Purchase: 'Purchase',
  Expense: 'Purchase',
  Check: 'Purchase',
  'Credit Card Expense': 'Purchase',
  'Credit Card Credit': 'Purchase',
  'Cash Expense': 'Purchase',
  Deposit: 'Deposit',
  'Bank Deposit': 'Deposit',
}

interface PurchaseLine {
  Id?: string
  Amount?: number
  Description?: string
  DetailType?: string
  AccountBasedExpenseLineDetail?: {
    AccountRef?: { value: string; name?: string }
  }
}

interface DepositLine {
  Id?: string
  Amount?: number
  Description?: string
  DetailType?: string
  DepositLineDetail?: {
    AccountRef?: { value: string; name?: string }
  }
}

interface QboObject {
  Id: string
  SyncToken: string
  PrivateNote?: string
  Line?: (PurchaseLine | DepositLine)[]
}

interface QboGetResponse {
  Purchase?: QboObject
  Deposit?: QboObject
  time?: string
}

interface QboUpdateResponse {
  Purchase?: QboObject
  Deposit?: QboObject
  time?: string
}

export interface WritebackInput {
  realmId: string
  clientId: string
  userId: string
  qboTxnType: string
  qboTxnId: string
  qboAccountId: string
  note: string
}

/**
 * Writeback de respuestas (uncats / amas) a QBO.
 *
 * v1: solo soporta Purchase y Deposit. Otros tipos (Bill, JournalEntry,
 * Transfer, etc.) lanzan TXN_TYPE_NOT_SUPPORTED. Cuando aparezca un caso
 * real con otro tipo, se agrega aquí. Documentado como deuda en CHANGELOG.
 *
 * Flujo:
 *  1. GET /v3/company/:realm/{type}/{id} → objeto + SyncToken.
 *  2. Mergea AccountRef en Line[0] (PurchaseDetail / DepositLineDetail) y
 *     PrivateNote con la nota.
 *  3. POST /v3/company/:realm/{type}?operation=update con el objeto.
 *  4. Si Intuit devuelve 400 con "Stale Object Update Exception" o status
 *     409, se traduce a INTUIT_STALE_SYNC_TOKEN (alguien editó en QBO
 *     entre nuestro GET y POST).
 */
@Injectable()
export class QboWritebackService {
  private readonly logger = new Logger(QboWritebackService.name)

  constructor(private readonly api: IntuitApiService) {}

  async writeback(input: WritebackInput): Promise<void> {
    const v3Type = TYPE_TO_V3[input.qboTxnType]
    if (!v3Type) {
      throw new QboTxnTypeNotSupportedError(input.qboTxnType)
    }

    const typeLower = v3Type.toLowerCase()
    const getPath = `/company/${input.realmId}/${typeLower}/${input.qboTxnId}`

    const getResp = await this.api.call<QboGetResponse>({
      clientId: input.clientId,
      userId: input.userId,
      method: 'GET',
      path: getPath,
    })

    const obj = v3Type === 'Purchase' ? getResp.Purchase : getResp.Deposit
    if (!obj) {
      throw new IntuitBadRequestError(`Intuit no devolvió ${v3Type} ${input.qboTxnId}`, {
        realmId: input.realmId,
      })
    }

    const merged = this.mergeChanges(obj, input, v3Type)

    const postPath = `/company/${input.realmId}/${typeLower}?operation=update`
    try {
      await this.api.call<QboUpdateResponse>({
        clientId: input.clientId,
        userId: input.userId,
        method: 'POST',
        path: postPath,
        body: merged,
      })
    } catch (err) {
      if (this.isStaleSyncToken(err)) {
        throw new QboStaleSyncTokenError(input.qboTxnId)
      }
      throw err
    }

    this.logger.log(
      `Writeback OK ${input.qboTxnType}/${input.qboTxnId} client=${input.clientId} account=${input.qboAccountId}`,
    )
  }

  private mergeChanges(
    obj: QboObject,
    input: WritebackInput,
    v3Type: 'Purchase' | 'Deposit',
  ): QboObject {
    const merged: QboObject = {
      ...obj,
      PrivateNote: input.note,
    }

    const lines = obj.Line ?? []
    if (lines.length === 0) {
      // Sin líneas no hay AccountRef que actualizar. Devolvemos el objeto
      // con solo el memo cambiado. Intuit aceptará el update sin tocar
      // categorías. Caso edge raro pero posible.
      return merged
    }

    if (v3Type === 'Purchase') {
      merged.Line = lines.map((line, idx) => {
        if (idx !== 0) return line
        const purchaseLine = line as PurchaseLine
        return {
          ...purchaseLine,
          Description: input.note,
          DetailType: 'AccountBasedExpenseLineDetail',
          AccountBasedExpenseLineDetail: {
            ...purchaseLine.AccountBasedExpenseLineDetail,
            AccountRef: { value: input.qboAccountId },
          },
        }
      })
    } else {
      merged.Line = lines.map((line, idx) => {
        if (idx !== 0) return line
        const depositLine = line as DepositLine
        return {
          ...depositLine,
          Description: input.note,
          DetailType: 'DepositLineDetail',
          DepositLineDetail: {
            ...depositLine.DepositLineDetail,
            AccountRef: { value: input.qboAccountId },
          },
        }
      })
    }

    return merged
  }

  private isStaleSyncToken(err: unknown): boolean {
    if (!(err instanceof IntuitBadRequestError)) return false
    const fault = err.details?.qboErrors as { body?: string } | undefined
    const body = fault?.body
    if (typeof body !== 'string') return false
    return /Stale Object Update Exception|stale.*synctoken/i.test(body)
  }
}
