import {
  CustomerSupportDashboardService,
  computeProgressPct,
  computeSilentStreakDays,
} from '../../../src/modules/13-views/customer-support/customer-support-dashboard.service'
import type { CustomerSupportDashboardRepository } from '../../../src/modules/13-views/customer-support/customer-support-dashboard.repository'
import type { ClientsRepository } from '../../../src/modules/11-clients/clients.repository'
import type { ClientPublicLinksRepository } from '../../../src/modules/12-customer-support/public-links/client-public-links.repository'
import type { AppConfigService } from '../../../src/core/config/config.service'
import { ClientNotFoundError } from '../../../src/modules/11-clients/clients.errors'
import type { Client } from '../../../src/db/schema/clients'

/**
 * Tests Tipo A para CustomerSupportDashboardService.
 *
 * Cobertura:
 * - CR-dash-001: progress_pct = 0 cuando uncats_count = 0.
 * - CR-dash-002: progress_pct correctamente calculado.
 * - CR-dash-003: silent_streak_days basado en last_reply_at si existe.
 * - CR-dash-004: silent_streak_days basado en sent_at si last_reply_at null.
 * - CR-dash-005: silent_streak_days = 0 si ambos null.
 * - CR-dash-006: getForClient lanza ClientNotFoundError si cliente no existe.
 * - CR-dash-007: getForClient con cliente sin transacciones devuelve stats con ceros.
 */

const NOW = new Date('2026-05-04T12:00:00Z')

function buildClient(overrides: Partial<Client> = {}): Client {
  return {
    id: 'c-1',
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

interface Mocks {
  repo: jest.Mocked<CustomerSupportDashboardRepository>
  clientsRepo: jest.Mocked<ClientsRepository>
  publicLinksRepo: { findLatestByClientAndPurpose: jest.Mock }
  cfg: { publicUrl: string }
}

function makeMocks(): Mocks {
  return {
    repo: {
      getStatsByClient: jest.fn().mockResolvedValue([]),
      getMonthlyHistogram: jest.fn().mockResolvedValue([]),
      getPreviousYearTotals: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<CustomerSupportDashboardRepository>,
    clientsRepo: {
      findById: jest.fn(),
    } as unknown as jest.Mocked<ClientsRepository>,
    publicLinksRepo: {
      findLatestByClientAndPurpose: jest.fn().mockResolvedValue(null),
    },
    cfg: { publicUrl: 'http://localhost:4000' },
  }
}

function buildService(m: Mocks): CustomerSupportDashboardService {
  return new CustomerSupportDashboardService(
    m.repo,
    m.clientsRepo,
    m.publicLinksRepo as unknown as ClientPublicLinksRepository,
    m.cfg as unknown as AppConfigService,
  )
}

describe('CustomerSupportDashboardService', () => {
  describe('CR-dash-001 — computeProgressPct con 0 uncats', () => {
    it('retorna 0 cuando uncats es 0', () => {
      expect(computeProgressPct(0, 0)).toBe(0)
      expect(computeProgressPct(5, 0)).toBe(0) // división por cero protegida
    })
  })

  describe('CR-dash-002 — computeProgressPct', () => {
    it('calcula correctamente', () => {
      expect(computeProgressPct(0, 10)).toBe(0)
      expect(computeProgressPct(5, 10)).toBe(50)
      expect(computeProgressPct(10, 10)).toBe(100)
      expect(computeProgressPct(3, 7)).toBe(43) // redondeo
    })
  })

  describe('CR-dash-003 — silent_streak con last_reply_at', () => {
    it('usa last_reply_at si existe', () => {
      const tenDaysAgo = new Date(NOW.getTime() - 10 * 24 * 3600 * 1000)
      const twentyDaysAgo = new Date(NOW.getTime() - 20 * 24 * 3600 * 1000)
      // last_reply_at gana sobre sent_at incluso si sent_at es más reciente
      const sentAtFiveDaysAgo = new Date(NOW.getTime() - 5 * 24 * 3600 * 1000)

      jest.useFakeTimers().setSystemTime(NOW)
      try {
        expect(computeSilentStreakDays(tenDaysAgo, sentAtFiveDaysAgo)).toBe(10)
        expect(computeSilentStreakDays(twentyDaysAgo, null)).toBe(20)
      } finally {
        jest.useRealTimers()
      }
    })
  })

  describe('CR-dash-004 — silent_streak fallback a sent_at', () => {
    it('usa sent_at cuando last_reply_at es null', () => {
      const fifteenDaysAgo = new Date(NOW.getTime() - 15 * 24 * 3600 * 1000)
      jest.useFakeTimers().setSystemTime(NOW)
      try {
        expect(computeSilentStreakDays(null, fifteenDaysAgo)).toBe(15)
      } finally {
        jest.useRealTimers()
      }
    })
  })

  describe('CR-dash-005 — silent_streak = 0 con ambos null', () => {
    it('cuando no hay sent ni reply', () => {
      expect(computeSilentStreakDays(null, null)).toBe(0)
    })
  })

  describe('CR-dash-006 — getForClient lanza si cliente no existe', () => {
    it('ClientNotFoundError', async () => {
      const m = makeMocks()
      m.clientsRepo.findById.mockResolvedValueOnce(null)
      const svc = buildService(m)
      await expect(
        svc.getForClient('missing', { from: '2025-01-01', to: '2026-04-30' }),
      ).rejects.toBeInstanceOf(ClientNotFoundError)
    })
  })

  describe('CR-dash-007 — cliente sin transacciones', () => {
    it('devuelve stats con ceros cuando no hay datos del cliente', async () => {
      const m = makeMocks()
      m.clientsRepo.findById.mockResolvedValueOnce(buildClient({ id: 'c-1' }))
      // repo retorna arrays vacíos (no hay transacciones del cliente)

      const svc = buildService(m)
      const result = await svc.getForClient('c-1', { from: '2025-01-01', to: '2026-04-30' })

      expect(result.stats.uncats_count).toBe(0)
      expect(result.stats.amas_count).toBe(0)
      expect(result.stats.responded_count).toBe(0)
      expect(result.stats.progress_pct).toBe(0)
      expect(result.stats.amount_total).toBe('0.00')
      expect(result.stats.last_synced_at).toBeNull()
      expect(result.stats.silent_streak_days).toBe(0)
      expect(result.followup.status).toBe('pending')
      expect(result.monthly.previous_year_total).toEqual({ uncats: 0, amas: 0 })
      expect(result.monthly.by_month).toHaveLength(12)
    })
  })

  describe('CR-dash-008 — listAll combina datos correctamente', () => {
    it('cliente con stats + monthly + previousYear', async () => {
      const m = makeMocks()
      m.repo.getStatsByClient.mockResolvedValueOnce([
        {
          client_id: 'c-1',
          legal_name: 'Acme',
          tier: 'gold',
          qbo_realm_id: 'r-1',
          primary_contact_name: 'Bob',
          primary_contact_email: 'bob@acme.com',
          transactions_filter: 'all',
          draft_email_enabled: true,
          cc_email: null,
          followup_status: 'sent',
          followup_sent_at: NOW,
          followup_last_reply_at: null,
          followup_internal_notes: null,
          uncats_count: 26,
          amas_count: 4,
          responded_count: 13,
          amount_total: '1500.00',
          last_synced_at: NOW,
        },
      ])
      m.repo.getMonthlyHistogram.mockResolvedValueOnce([
        { client_id: 'c-1', year: 2026, month: 1, uncats: 16, amas: 0 },
        { client_id: 'c-1', year: 2026, month: 2, uncats: 7, amas: 0 },
      ])
      m.repo.getPreviousYearTotals.mockResolvedValueOnce([{ client_id: 'c-1', uncats: 1, amas: 0 }])

      const svc = buildService(m)
      const result = await svc.listAll({ from: '2025-01-01', to: '2026-04-30' })

      expect(result).toHaveLength(1)
      expect(result[0]?.stats.uncats_count).toBe(26)
      expect(result[0]?.stats.progress_pct).toBe(50) // 13/26
      expect(result[0]?.monthly.previous_year_total.uncats).toBe(1)
      expect(result[0]?.monthly.by_month[0]).toEqual({ month: 1, uncats: 16, amas: 0 })
      expect(result[0]?.monthly.by_month[1]).toEqual({ month: 2, uncats: 7, amas: 0 })
      expect(result[0]?.monthly.by_month[3]).toEqual({ month: 4, uncats: 0, amas: 0 }) // mes sin data
    })
  })
})
