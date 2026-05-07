import { TransactionsSyncService } from '../../../src/modules/12-customer-support/transactions/transactions-sync.service'
import type { ClientTransactionsRepository } from '../../../src/modules/12-customer-support/transactions/client-transactions.repository'
import type { ClientsRepository } from '../../../src/modules/11-clients/clients.repository'
import type { IntuitApiService } from '../../../src/modules/20-intuit-oauth/api-client/intuit-api.service'
import type { EventLogService } from '../../../src/modules/95-event-log/event-log.service'
import { ClientNotFoundError } from '../../../src/modules/11-clients/clients.errors'
import { ClientNotConnectedError } from '../../../src/modules/12-customer-support/customer-support.errors'
import type { Client } from '../../../src/db/schema/clients'

/**
 * Tests Tipo A para TransactionsSyncService.
 *
 * Cobertura:
 * - CR-cs-001: syncFromQbo lanza ClientNotFoundError si cliente no existe.
 * - CR-cs-002: lanza ClientNotConnectedError si client.qboRealmId es null.
 * - CR-cs-003: parsea TransactionList correctamente — filtra por regex y mapea categorías.
 * - CR-cs-004: AMA detection (regex /ask/i en ColData[7]).
 * - CR-cs-005: Deposit → uncategorized_income, resto → uncategorized_expense.
 * - CR-cs-006: ejecuta DELETE + INSERT y retorna counts.
 * - CR-cs-007: emite evento client_transactions.synced.
 */

const NOW = new Date('2026-05-04T12:00:00Z')

function buildClient(overrides: Partial<Client> = {}): Client {
  return {
    id: 'client-1',
    legalName: 'Acme LLC',
    dba: null,
    qboRealmId: 'realm-1',
    industry: null,
    entityType: null,
    fiscalYearStart: null,
    timezone: null,
    status: 'active',
    tier: 'silver',
    draftEmailEnabled: true,
    transactionsFilter: 'all',
    ccEmail: null,
    primaryContactName: null,
    primaryContactEmail: null,
    notes: null,
    metadata: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}

function buildIntuitResponse(
  rows: {
    date: string
    type: string
    id: string
    docnum: string
    vendor: string
    memo: string
    account: string
    category: string
    amount: string
  }[],
): unknown {
  return {
    Rows: {
      Row: rows.map((r) => ({
        ColData: [
          { value: r.date }, // 0: date
          { value: r.type, id: r.id }, // 1: transaction_type + id
          { value: r.docnum }, // 2: docnum
          { value: '' }, // 3: unused
          { value: r.vendor }, // 4: vendor
          { value: r.memo }, // 5: memo
          { value: r.account }, // 6: split account
          { value: r.category }, // 7: category
          { value: r.amount }, // 8: amount
        ],
      })),
    },
  }
}

interface Mocks {
  clientsRepo: jest.Mocked<ClientsRepository>
  txnRepo: jest.Mocked<ClientTransactionsRepository>
  api: jest.Mocked<IntuitApiService>
  events: { log: jest.Mock }
}

function makeMocks(): Mocks {
  return {
    clientsRepo: {
      findById: jest.fn(),
    } as unknown as jest.Mocked<ClientsRepository>,
    txnRepo: {
      deleteByClientAndDateRange: jest.fn().mockResolvedValue(0),
      insertMany: jest.fn().mockResolvedValue(0),
    } as unknown as jest.Mocked<ClientTransactionsRepository>,
    api: {
      call: jest.fn(),
    } as unknown as jest.Mocked<IntuitApiService>,
    events: { log: jest.fn().mockResolvedValue(undefined) },
  }
}

function buildService(m: Mocks): TransactionsSyncService {
  return new TransactionsSyncService(
    m.clientsRepo,
    m.txnRepo,
    m.api,
    m.events as unknown as EventLogService,
  )
}

describe('TransactionsSyncService', () => {
  describe('CR-cs-001 — ClientNotFoundError', () => {
    it('lanza si findById retorna null', async () => {
      const m = makeMocks()
      m.clientsRepo.findById.mockResolvedValueOnce(null)

      const svc = buildService(m)
      await expect(svc.syncFromQbo('missing', '2025-01-01', '2026-04-30')).rejects.toBeInstanceOf(
        ClientNotFoundError,
      )
      expect(m.api.call).not.toHaveBeenCalled()
    })
  })

  describe('CR-cs-002 — ClientNotConnectedError', () => {
    it('lanza si client.qboRealmId es null', async () => {
      const m = makeMocks()
      m.clientsRepo.findById.mockResolvedValueOnce(buildClient({ qboRealmId: null }))

      const svc = buildService(m)
      await expect(svc.syncFromQbo('client-1', '2025-01-01', '2026-04-30')).rejects.toBeInstanceOf(
        ClientNotConnectedError,
      )
      expect(m.api.call).not.toHaveBeenCalled()
    })
  })

  describe('CR-cs-003 — parseo y filtro por regex', () => {
    it('filtra rows con uncategorized expense/income/suspense/ask y descarta el resto', async () => {
      const m = makeMocks()
      m.clientsRepo.findById.mockResolvedValueOnce(buildClient())
      m.api.call.mockResolvedValueOnce(
        buildIntuitResponse([
          {
            date: '2026-04-01',
            type: 'Expense',
            id: '101',
            docnum: '',
            vendor: 'Acme',
            memo: 'lunch',
            account: 'Bank',
            category: 'Uncategorized Expense',
            amount: '50.00',
          },
          {
            date: '2026-04-02',
            type: 'Deposit',
            id: '102',
            docnum: '',
            vendor: '',
            memo: 'wire',
            account: 'Bank',
            category: 'Uncategorized Income',
            amount: '1000.00',
          },
          {
            date: '2026-04-03',
            type: 'Check',
            id: '103',
            docnum: '1042',
            vendor: 'Vendor',
            memo: 'rent',
            account: 'Bank',
            category: 'Suspense',
            amount: '500.00',
          },
          {
            date: '2026-04-04',
            type: 'Bill',
            id: '104',
            docnum: '',
            vendor: 'X',
            memo: 'q',
            account: 'Bank',
            category: 'Ask My Accountant',
            amount: '75.00',
          },
          {
            date: '2026-04-05',
            type: 'Expense',
            id: '105',
            docnum: '',
            vendor: 'Y',
            memo: 'normal',
            account: 'Bank',
            category: 'Office Supplies',
            amount: '25.00',
          },
        ]),
      )
      m.txnRepo.deleteByClientAndDateRange.mockResolvedValueOnce(0)
      m.txnRepo.insertMany.mockResolvedValueOnce(4)

      const svc = buildService(m)
      const result = await svc.syncFromQbo('client-1', '2025-01-01', '2026-04-30')

      expect(result.insertedCount).toBe(4)
      const insertCall = m.txnRepo.insertMany.mock.calls[0]?.[0]
      expect(insertCall).toHaveLength(4)
      expect(insertCall?.find((r) => r.qboTxnId === '105')).toBeUndefined()
    })
  })

  describe('CR-cs-004 — AMA classification', () => {
    it('row con "Ask My Accountant" se mapea a category=ask_my_accountant', async () => {
      const m = makeMocks()
      m.clientsRepo.findById.mockResolvedValueOnce(buildClient())
      m.api.call.mockResolvedValueOnce(
        buildIntuitResponse([
          {
            date: '2026-04-04',
            type: 'Bill',
            id: '104',
            docnum: '',
            vendor: 'X',
            memo: 'q',
            account: 'Bank',
            category: 'Ask My Accountant',
            amount: '75.00',
          },
        ]),
      )

      const svc = buildService(m)
      await svc.syncFromQbo('client-1', '2025-01-01', '2026-04-30')

      const inserted = m.txnRepo.insertMany.mock.calls[0]?.[0]?.[0]
      expect(inserted?.category).toBe('ask_my_accountant')
    })
  })

  describe('CR-cs-005 — Deposit → income, resto → expense', () => {
    it('Deposit con Uncategorized Income → uncategorized_income', async () => {
      const m = makeMocks()
      m.clientsRepo.findById.mockResolvedValueOnce(buildClient())
      m.api.call.mockResolvedValueOnce(
        buildIntuitResponse([
          {
            date: '2026-04-02',
            type: 'Deposit',
            id: '102',
            docnum: '',
            vendor: '',
            memo: 'w',
            account: 'B',
            category: 'Uncategorized Income',
            amount: '1000',
          },
        ]),
      )

      const svc = buildService(m)
      await svc.syncFromQbo('client-1', '2025-01-01', '2026-04-30')

      expect(m.txnRepo.insertMany.mock.calls[0]?.[0]?.[0]?.category).toBe('uncategorized_income')
    })

    it('Expense con Suspense → uncategorized_expense', async () => {
      const m = makeMocks()
      m.clientsRepo.findById.mockResolvedValueOnce(buildClient())
      m.api.call.mockResolvedValueOnce(
        buildIntuitResponse([
          {
            date: '2026-04-03',
            type: 'Check',
            id: '103',
            docnum: '',
            vendor: 'V',
            memo: '',
            account: 'B',
            category: 'Suspense',
            amount: '500',
          },
        ]),
      )

      const svc = buildService(m)
      await svc.syncFromQbo('client-1', '2025-01-01', '2026-04-30')

      expect(m.txnRepo.insertMany.mock.calls[0]?.[0]?.[0]?.category).toBe('uncategorized_expense')
    })
  })

  describe('CR-cs-006 — DELETE + INSERT', () => {
    it('llama deleteByClientAndDateRange y insertMany con counts correctos', async () => {
      const m = makeMocks()
      m.clientsRepo.findById.mockResolvedValueOnce(buildClient())
      m.api.call.mockResolvedValueOnce(
        buildIntuitResponse([
          {
            date: '2026-04-01',
            type: 'Expense',
            id: '101',
            docnum: '',
            vendor: 'A',
            memo: '',
            account: 'B',
            category: 'Uncategorized Expense',
            amount: '50',
          },
        ]),
      )
      m.txnRepo.deleteByClientAndDateRange.mockResolvedValueOnce(5)
      m.txnRepo.insertMany.mockResolvedValueOnce(1)

      const svc = buildService(m)
      const result = await svc.syncFromQbo('client-1', '2025-01-01', '2026-04-30')

      expect(m.txnRepo.deleteByClientAndDateRange).toHaveBeenCalledWith(
        'client-1',
        '2025-01-01',
        '2026-04-30',
      )
      expect(result.deletedCount).toBe(5)
      expect(result.insertedCount).toBe(1)
    })

    it('amount se guarda como string positivo (Math.abs)', async () => {
      const m = makeMocks()
      m.clientsRepo.findById.mockResolvedValueOnce(buildClient())
      m.api.call.mockResolvedValueOnce(
        buildIntuitResponse([
          {
            date: '2026-04-01',
            type: 'Expense',
            id: '101',
            docnum: '',
            vendor: 'A',
            memo: '',
            account: 'B',
            category: 'Uncategorized Expense',
            amount: '-50.00',
          },
        ]),
      )

      const svc = buildService(m)
      await svc.syncFromQbo('client-1', '2025-01-01', '2026-04-30')

      expect(m.txnRepo.insertMany.mock.calls[0]?.[0]?.[0]?.amount).toBe('50')
    })
  })

  describe('CR-cs-007 — emite evento', () => {
    it('emite client_transactions.synced con clientId, dates y counts', async () => {
      const m = makeMocks()
      m.clientsRepo.findById.mockResolvedValueOnce(buildClient())
      m.api.call.mockResolvedValueOnce(buildIntuitResponse([]))
      m.txnRepo.deleteByClientAndDateRange.mockResolvedValueOnce(3)

      const svc = buildService(m)
      await svc.syncFromQbo('client-1', '2025-01-01', '2026-04-30')

      expect(m.events.log).toHaveBeenCalledWith(
        'client_transactions.synced',
        expect.objectContaining({
          clientId: 'client-1',
          startDate: '2025-01-01',
          endDate: '2026-04-30',
          deletedCount: 3,
          insertedCount: 0,
        }),
        undefined,
        { type: 'client', id: 'client-1' },
      )
    })
  })
})
