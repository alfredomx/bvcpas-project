import { ClientPeriodFollowupsService } from '../../../src/modules/12-customer-support/followups/client-period-followups.service'
import type { ClientPeriodFollowupsRepository } from '../../../src/modules/12-customer-support/followups/client-period-followups.repository'
import type { EventLogService } from '../../../src/modules/95-event-log/event-log.service'
import type { ClientPeriodFollowup } from '../../../src/db/schema/client-period-followups'

/**
 * Tests Tipo A para ClientPeriodFollowupsService.
 *
 * Cobertura:
 * - CR-cs-020: getOrInit retorna default pending si no existe row.
 * - CR-cs-021: getOrInit retorna el row existente.
 * - CR-cs-022: update emite client_followup.status_changed cuando el status cambia.
 * - CR-cs-023: update NO emite evento si el status NO cambia.
 */

const NOW = new Date()

function buildRow(overrides: Partial<ClientPeriodFollowup> = {}): ClientPeriodFollowup {
  return {
    id: 'fup-1',
    clientId: 'c-1',
    period: '2026-04',
    status: 'pending',
    sentAt: null,
    lastReplyAt: null,
    sentByUserId: null,
    internalNotes: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}

interface Mocks {
  repo: jest.Mocked<ClientPeriodFollowupsRepository>
  events: { log: jest.Mock }
}

function makeMocks(): Mocks {
  return {
    repo: {
      findByClientAndPeriod: jest.fn(),
      upsert: jest.fn(),
    } as unknown as jest.Mocked<ClientPeriodFollowupsRepository>,
    events: { log: jest.fn().mockResolvedValue(undefined) },
  }
}

function buildService(m: Mocks): ClientPeriodFollowupsService {
  return new ClientPeriodFollowupsService(m.repo, m.events as unknown as EventLogService)
}

describe('ClientPeriodFollowupsService', () => {
  describe('CR-cs-020 — getOrInit default pending', () => {
    it('retorna default sin escribir en DB cuando no existe', async () => {
      const m = makeMocks()
      m.repo.findByClientAndPeriod.mockResolvedValueOnce(null)

      const svc = buildService(m)
      const result = await svc.getOrInit('c-1', '2026-04')

      expect(result).toEqual({
        clientId: 'c-1',
        period: '2026-04',
        status: 'pending',
        sentAt: null,
        lastReplyAt: null,
        sentByUserId: null,
        internalNotes: null,
      })
      expect(m.repo.upsert).not.toHaveBeenCalled()
    })
  })

  describe('CR-cs-021 — getOrInit retorna existente', () => {
    it('retorna el row si existe', async () => {
      const m = makeMocks()
      m.repo.findByClientAndPeriod.mockResolvedValueOnce(
        buildRow({ status: 'sent', sentAt: NOW, internalNotes: 'foo' }),
      )

      const svc = buildService(m)
      const result = await svc.getOrInit('c-1', '2026-04')

      expect(result.status).toBe('sent')
      expect(result.internalNotes).toBe('foo')
    })
  })

  describe('CR-cs-022 — update emite evento cuando cambia status', () => {
    it('pending → sent emite client_followup.status_changed', async () => {
      const m = makeMocks()
      m.repo.findByClientAndPeriod.mockResolvedValueOnce(buildRow({ status: 'pending' }))
      m.repo.upsert.mockResolvedValueOnce(buildRow({ status: 'sent' }))

      const svc = buildService(m)
      await svc.update('c-1', '2026-04', { status: 'sent' }, 'admin-1')

      expect(m.events.log).toHaveBeenCalledWith(
        'client_followup.status_changed',
        expect.objectContaining({
          clientId: 'c-1',
          period: '2026-04',
          fromStatus: 'pending',
          toStatus: 'sent',
        }),
        'admin-1',
        { type: 'client', id: 'c-1' },
      )
    })
  })

  describe('CR-cs-023 — update NO emite si status no cambia', () => {
    it('actualizar internalNotes sin cambiar status no emite evento', async () => {
      const m = makeMocks()
      m.repo.findByClientAndPeriod.mockResolvedValueOnce(buildRow({ status: 'sent' }))
      m.repo.upsert.mockResolvedValueOnce(buildRow({ status: 'sent', internalNotes: 'nueva nota' }))

      const svc = buildService(m)
      await svc.update('c-1', '2026-04', { internalNotes: 'nueva nota' }, 'admin-1')

      expect(m.events.log).not.toHaveBeenCalled()
    })
  })
})
