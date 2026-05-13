import { ClientTransactionResponsesService } from '../../../src/modules/12-customer-support/responses/client-transaction-responses.service'
import type { ClientTransactionResponsesRepository } from '../../../src/modules/12-customer-support/responses/client-transaction-responses.repository'
import type { ClientTransactionsRepository } from '../../../src/modules/12-customer-support/transactions/client-transactions.repository'
import type { ClientPeriodFollowupsRepository } from '../../../src/modules/12-customer-support/followups/client-period-followups.repository'
import type { EventLogService } from '../../../src/modules/95-event-log/event-log.service'
import type { QboWritebackService } from '../../../src/modules/12-customer-support/responses/qbo-writeback.service'
import {
  QboAccountIdRequiredError,
  TransactionNotFoundInSnapshotError,
} from '../../../src/modules/12-customer-support/customer-support.errors'
import type { ClientTransaction } from '../../../src/db/schema/client-transactions'
import type { ClientTransactionResponse } from '../../../src/db/schema/client-transaction-responses'

/**
 * Tests Tipo A para ClientTransactionResponsesService.
 *
 * Cobertura:
 * - CR-cs-010: saveResponse lanza TransactionNotFoundInSnapshotError si la txn no está.
 * - CR-cs-011: saveResponse hace upsert con snapshot inline de la transacción.
 * - CR-cs-012: emite client_transaction_response.saved con isUpdate=false en INSERT.
 * - CR-cs-013: emite client_transaction_response.saved con isUpdate=true en UPDATE.
 */

const NOW = new Date('2026-05-04T12:00:00Z')
const TXN_UUID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'

function buildTxn(overrides: Partial<ClientTransaction> = {}): ClientTransaction {
  return {
    id: TXN_UUID,
    realmId: 'r-1',
    qboTxnType: 'Purchase',
    qboTxnId: '101',
    clientId: 'c-1',
    txnDate: '2026-04-15',
    docnum: null,
    vendorName: 'Acme',
    memo: 'lunch',
    splitAccount: 'Bank',
    qboAccountId: null,
    category: 'uncategorized_expense',
    amount: '50.00',
    syncedAt: NOW,
    ...overrides,
  }
}

function buildResponse(
  overrides: Partial<ClientTransactionResponse> = {},
): ClientTransactionResponse {
  return {
    id: 'resp-1',
    clientId: 'c-1',
    realmId: 'r-1',
    qboTxnType: 'Purchase',
    qboTxnId: '101',
    txnDate: '2026-04-15',
    vendorName: 'Acme',
    memo: 'lunch',
    splitAccount: 'Bank',
    category: 'uncategorized_expense',
    amount: '50.00',
    clientNote: 'lunch with vendor',
    appendedText: null,
    qboAccountId: null,
    completed: false,
    respondedAt: NOW,
    syncedToQboAt: null,
    deletedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}

interface Mocks {
  responsesRepo: jest.Mocked<ClientTransactionResponsesRepository>
  txnRepo: jest.Mocked<ClientTransactionsRepository>
  followupsRepo: { maybeMarkFullyResponded: jest.Mock }
  events: { log: jest.Mock }
  writeback: { writeback: jest.Mock }
}

function makeMocks(): Mocks {
  return {
    responsesRepo: {
      findByTxn: jest.fn(),
      upsert: jest.fn(),
      listByClient: jest.fn(),
      markSyncedToQbo: jest.fn(),
    } as unknown as jest.Mocked<ClientTransactionResponsesRepository>,
    txnRepo: {
      findById: jest.fn(),
    } as unknown as jest.Mocked<ClientTransactionsRepository>,
    followupsRepo: { maybeMarkFullyResponded: jest.fn().mockResolvedValue(false) },
    events: { log: jest.fn().mockResolvedValue(undefined) },
    writeback: { writeback: jest.fn().mockResolvedValue(undefined) },
  }
}

function buildService(m: Mocks): ClientTransactionResponsesService {
  return new ClientTransactionResponsesService(
    m.responsesRepo,
    m.txnRepo,
    m.followupsRepo as unknown as ClientPeriodFollowupsRepository,
    m.events as unknown as EventLogService,
    m.writeback as unknown as QboWritebackService,
  )
}

describe('ClientTransactionResponsesService', () => {
  describe('CR-cs-010 — TransactionNotFoundInSnapshotError', () => {
    it('lanza si la transacción no existe en el snapshot', async () => {
      const m = makeMocks()
      m.txnRepo.findById.mockResolvedValueOnce(null)

      const svc = buildService(m)
      await expect(svc.saveResponse({ txnId: TXN_UUID, note: 'algo' })).rejects.toBeInstanceOf(
        TransactionNotFoundInSnapshotError,
      )
      expect(m.responsesRepo.upsert).not.toHaveBeenCalled()
    })
  })

  describe('CR-cs-011 — UPSERT con snapshot inline', () => {
    it('copia los campos de la transacción al insert/update', async () => {
      const m = makeMocks()
      m.txnRepo.findById.mockResolvedValueOnce(buildTxn())
      m.responsesRepo.findByTxn.mockResolvedValueOnce(null)
      m.responsesRepo.upsert.mockResolvedValueOnce(buildResponse())

      const svc = buildService(m)
      await svc.saveResponse({ txnId: TXN_UUID, note: 'mi nota' })

      const upsertArg = m.responsesRepo.upsert.mock.calls[0]?.[0]
      expect(upsertArg).toMatchObject({
        clientId: 'c-1',
        realmId: 'r-1',
        qboTxnType: 'Purchase',
        qboTxnId: '101',
        txnDate: '2026-04-15',
        vendorName: 'Acme',
        memo: 'lunch',
        category: 'uncategorized_expense',
        amount: '50.00',
        clientNote: 'mi nota',
      })
    })
  })

  describe('CR-cs-012 — evento isUpdate=false', () => {
    it('cuando no había respuesta previa', async () => {
      const m = makeMocks()
      m.txnRepo.findById.mockResolvedValueOnce(buildTxn())
      m.responsesRepo.findByTxn.mockResolvedValueOnce(null)
      m.responsesRepo.upsert.mockResolvedValueOnce(buildResponse())

      const svc = buildService(m)
      await svc.saveResponse({ txnId: TXN_UUID, note: 'nueva' })

      expect(m.events.log).toHaveBeenCalledWith(
        'client_transaction_response.saved',
        expect.objectContaining({ clientId: 'c-1', qboTxnId: '101', isUpdate: false }),
        undefined,
        { type: 'client', id: 'c-1' },
      )
    })
  })

  describe('CR-cs-013 — evento isUpdate=true', () => {
    it('cuando ya había respuesta previa', async () => {
      const m = makeMocks()
      m.txnRepo.findById.mockResolvedValueOnce(buildTxn())
      m.responsesRepo.findByTxn.mockResolvedValueOnce(buildResponse())
      m.responsesRepo.upsert.mockResolvedValueOnce(buildResponse({ clientNote: 'editada' }))

      const svc = buildService(m)
      await svc.saveResponse({ txnId: TXN_UUID, note: 'editada' })

      expect(m.events.log).toHaveBeenCalledWith(
        'client_transaction_response.saved',
        expect.objectContaining({ isUpdate: true }),
        undefined,
        expect.any(Object),
      )
    })
  })

  describe('CR-cs-014 — qboSync sin qboAccountId', () => {
    it('lanza QboAccountIdRequiredError antes de tocar DB', async () => {
      const m = makeMocks()
      m.txnRepo.findById.mockResolvedValueOnce(buildTxn())

      const svc = buildService(m)
      await expect(
        svc.saveResponse({
          txnId: TXN_UUID,
          note: 'algo',
          qboSync: true,
          userId: 'u-1',
        }),
      ).rejects.toBeInstanceOf(QboAccountIdRequiredError)
      expect(m.responsesRepo.upsert).not.toHaveBeenCalled()
      expect(m.writeback.writeback).not.toHaveBeenCalled()
    })
  })

  describe('CR-cs-015 — qboSync happy path', () => {
    it('hace upsert (respeta completed del input), llama writeback, marca synced y emite evento', async () => {
      const m = makeMocks()
      m.txnRepo.findById.mockResolvedValueOnce(buildTxn())
      m.responsesRepo.findByTxn.mockResolvedValueOnce(null)
      const inserted = buildResponse({ qboAccountId: '82', completed: false })
      m.responsesRepo.upsert.mockResolvedValueOnce(inserted)
      m.responsesRepo.markSyncedToQbo.mockResolvedValueOnce(
        buildResponse({ qboAccountId: '82', completed: false, syncedToQboAt: NOW }),
      )

      const svc = buildService(m)
      const result = await svc.saveResponse({
        txnId: TXN_UUID,
        note: 'office supplies',
        qboAccountId: '82',
        completed: false,
        qboSync: true,
        userId: 'u-1',
      })

      expect(m.responsesRepo.upsert.mock.calls[0]?.[0]?.completed).toBe(false)
      expect(m.writeback.writeback).toHaveBeenCalledWith(
        expect.objectContaining({
          realmId: 'r-1',
          clientId: 'c-1',
          userId: 'u-1',
          qboTxnType: 'Purchase',
          qboTxnId: '101',
          qboAccountId: '82',
          note: 'office supplies',
        }),
      )
      expect(m.responsesRepo.markSyncedToQbo).toHaveBeenCalledWith(inserted.id)
      expect(m.events.log).toHaveBeenCalledWith(
        'client_transaction_response.qbo_synced',
        expect.objectContaining({ qboAccountId: '82' }),
        'u-1',
        expect.any(Object),
      )
      expect(result.syncedToQboAt).not.toBeNull()
    })
  })
})
