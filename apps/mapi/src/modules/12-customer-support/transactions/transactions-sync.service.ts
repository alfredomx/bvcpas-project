import { Injectable, Logger } from '@nestjs/common'
import { ClientsRepository } from '../../11-clients/clients.repository'
import { ClientNotFoundError } from '../../11-clients/clients.errors'
import { IntuitApiService } from '../../20-intuit-oauth/api-client/intuit-api.service'
import { EventLogService } from '../../95-event-log/event-log.service'
import type {
  ClientTransactionCategory,
  NewClientTransaction,
} from '../../../db/schema/client-transactions'
import { ClientNotConnectedError } from '../customer-support.errors'
import { ClientTransactionsRepository } from './client-transactions.repository'

interface QBColData {
  value: string
  id?: string
}

interface QBRow {
  ColData: QBColData[]
}

interface QBTransactionListResponse {
  Rows?: {
    Row?: QBRow[]
  }
}

const ROW_FILTER_REGEX = /uncategorized (expense|income)|suspense|ask/i
const AMA_REGEX = /ask/i

export interface SyncResult {
  clientId: string
  startDate: string
  endDate: string
  deletedCount: number
  insertedCount: number
  durationMs: number
}

/**
 * Service que pulla TransactionList de Intuit y persiste el snapshot en
 * `client_transactions`. Modelo de borrón total dentro del rango: cada
 * sync borra todo lo que cae dentro de [startDate, endDate] y reinserta
 * lo que vino de Intuit.
 *
 * Las respuestas del cliente viven en `client_transaction_responses` (otra
 * tabla, otro service) y NO se tocan acá.
 */
@Injectable()
export class TransactionsSyncService {
  private readonly logger = new Logger(TransactionsSyncService.name)

  constructor(
    private readonly clientsRepo: ClientsRepository,
    private readonly txnRepo: ClientTransactionsRepository,
    private readonly api: IntuitApiService,
    private readonly events: EventLogService,
  ) {}

  async syncFromQbo(clientId: string, startDate: string, endDate: string): Promise<SyncResult> {
    const startedAt = Date.now()
    const client = await this.clientsRepo.findById(clientId)
    if (!client) throw new ClientNotFoundError(clientId)
    if (!client.qboRealmId) throw new ClientNotConnectedError(clientId)

    const realmId = client.qboRealmId
    const path =
      `/company/${realmId}/reports/TransactionList` +
      `?start_date=${startDate}&end_date=${endDate}&accounting_method=Accrual`

    this.logger.log(`Syncing transactions for client=${clientId} ${startDate}..${endDate}`)
    const response = await this.api.call<QBTransactionListResponse>({
      clientId,
      method: 'GET',
      path,
    })

    const rows = parseTransactionList(response, clientId, realmId)

    const deletedCount = await this.txnRepo.deleteByClientAndDateRange(clientId, startDate, endDate)
    const insertedCount = rows.length > 0 ? await this.txnRepo.insertMany(rows) : 0

    const durationMs = Date.now() - startedAt
    const result: SyncResult = {
      clientId,
      startDate,
      endDate,
      deletedCount,
      insertedCount,
      durationMs,
    }

    await this.events.log(
      'client_transactions.synced',
      result as unknown as Record<string, unknown>,
      undefined,
      {
        type: 'client',
        id: clientId,
      },
    )

    return result
  }
}

function parseTransactionList(
  response: QBTransactionListResponse,
  clientId: string,
  realmId: string,
): NewClientTransaction[] {
  const rawRows = response.Rows?.Row ?? []
  return rawRows
    .filter((row) => {
      const categoryCell = row.ColData[7]?.value ?? ''
      return ROW_FILTER_REGEX.test(categoryCell)
    })
    .map((row) => mapRow(row, clientId, realmId))
}

function mapRow(row: QBRow, clientId: string, realmId: string): NewClientTransaction {
  const txnTypeCell = row.ColData[1]
  const categoryCell = row.ColData[7]?.value ?? ''
  const amountCell = row.ColData[8]?.value ?? '0'

  const qboTxnType = txnTypeCell?.value ?? 'Unknown'
  const qboTxnId = txnTypeCell?.id ?? ''

  return {
    realmId,
    qboTxnType,
    qboTxnId,
    clientId,
    txnDate: row.ColData[0]?.value ?? '',
    docnum: row.ColData[2]?.value || null,
    vendorName: row.ColData[4]?.value || null,
    memo: row.ColData[5]?.value || null,
    splitAccount: row.ColData[6]?.value || null,
    category: classifyCategory(categoryCell, qboTxnType),
    amount: String(Math.abs(Number(amountCell))),
  }
}

function classifyCategory(rawCategory: string, txnType: string): ClientTransactionCategory {
  if (AMA_REGEX.test(rawCategory)) return 'ask_my_accountant'
  if (txnType === 'Deposit') return 'uncategorized_income'
  return 'uncategorized_expense'
}
