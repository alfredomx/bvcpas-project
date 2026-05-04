import { ClientsService } from '../../../src/modules/11-clients/clients.service'
import type { ClientsRepository } from '../../../src/modules/11-clients/clients.repository'
import type { EventLogService } from '../../../src/modules/95-event-log/event-log.service'
import { ClientNotFoundError } from '../../../src/modules/20-intuit-oauth/intuit-oauth.errors'
import type { Client } from '../../../src/db/schema/clients'

/**
 * Tests Tipo A para ClientsService. Sin DB ni red.
 *
 * Cobertura:
 * - CR-clients-001: list() pasa paginación al repo y retorna shape esperado.
 * - CR-clients-002: list() pasa filtros status y search al repo.
 * - CR-clients-003: getById() lanza ClientNotFoundError si no existe.
 * - CR-clients-004: getById() retorna el cliente.
 * - CR-clients-005: update() actualiza vía repo y emite client.updated con diff.
 * - CR-clients-006: update() lanza ClientNotFoundError si no existe.
 * - CR-clients-007: changeStatus() actualiza solo status y emite client.status_changed.
 */

const NOW = new Date('2026-05-03T12:00:00Z')

function buildClient(overrides: Partial<Client> = {}): Client {
  return {
    id: 'client-uuid-1',
    legalName: 'Acme LLC',
    dba: null,
    qboRealmId: 'realm-1',
    industry: null,
    entityType: null,
    fiscalYearStart: null,
    timezone: null,
    status: 'active',
    tier: 'silver',
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
  repo: jest.Mocked<ClientsRepository>
  events: { log: jest.Mock }
}

function makeMocks(): Mocks {
  return {
    repo: {
      findById: jest.fn(),
      findByRealmId: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      list: jest.fn(),
    } as unknown as jest.Mocked<ClientsRepository>,
    events: { log: jest.fn().mockResolvedValue(undefined) },
  }
}

function buildService(m: Mocks): ClientsService {
  return new ClientsService(m.repo, m.events as unknown as EventLogService)
}

describe('ClientsService', () => {
  describe('CR-clients-001 — list() paginación', () => {
    it('pasa page y pageSize al repo y retorna {items,total,page,pageSize}', async () => {
      const m = makeMocks()
      m.repo.list.mockResolvedValueOnce({ items: [buildClient()], total: 77 })

      const svc = buildService(m)
      const result = await svc.list({ page: 2, pageSize: 25 })

      expect(m.repo.list).toHaveBeenCalledWith({ page: 2, pageSize: 25 })
      expect(result).toEqual({
        items: expect.any(Array),
        total: 77,
        page: 2,
        pageSize: 25,
      })
    })
  })

  describe('CR-clients-002 — list() filtros', () => {
    it('pasa status y search al repo', async () => {
      const m = makeMocks()
      m.repo.list.mockResolvedValueOnce({ items: [], total: 0 })

      const svc = buildService(m)
      await svc.list({ page: 1, pageSize: 50, status: 'active', search: 'acme' })

      expect(m.repo.list).toHaveBeenCalledWith({
        page: 1,
        pageSize: 50,
        status: 'active',
        search: 'acme',
      })
    })

    it('CR-clients-002b — pasa tier al repo cuando se filtra', async () => {
      const m = makeMocks()
      m.repo.list.mockResolvedValueOnce({ items: [], total: 0 })

      const svc = buildService(m)
      await svc.list({ page: 1, pageSize: 50, tier: 'gold' })

      expect(m.repo.list).toHaveBeenCalledWith({
        page: 1,
        pageSize: 50,
        tier: 'gold',
      })
    })
  })

  describe('CR-clients-008 — update() acepta tier', () => {
    it('cambio de tier silver→platinum se persiste y emite client.updated', async () => {
      const m = makeMocks()
      const before = buildClient({ id: 'c1', tier: 'silver' })
      const after = { ...before, tier: 'platinum' as const }
      m.repo.findById.mockResolvedValueOnce(before)
      m.repo.update.mockResolvedValueOnce(after)

      const svc = buildService(m)
      const result = await svc.update('c1', { tier: 'platinum' }, 'admin-uuid')

      expect(result.tier).toBe('platinum')
      expect(m.repo.update).toHaveBeenCalledWith('c1', { tier: 'platinum' })
      expect(m.events.log).toHaveBeenCalledWith(
        'client.updated',
        expect.objectContaining({
          clientId: 'c1',
          changedFields: expect.arrayContaining(['tier']),
        }),
        'admin-uuid',
        { type: 'client', id: 'c1' },
      )
    })
  })

  describe('CR-clients-003 — getById() lanza ClientNotFoundError', () => {
    it('si findById retorna null, lanza', async () => {
      const m = makeMocks()
      m.repo.findById.mockResolvedValueOnce(null)

      const svc = buildService(m)
      await expect(svc.getById('missing-id')).rejects.toBeInstanceOf(ClientNotFoundError)
    })
  })

  describe('CR-clients-004 — getById() retorna cliente', () => {
    it('retorna el cliente si existe', async () => {
      const m = makeMocks()
      m.repo.findById.mockResolvedValueOnce(buildClient({ id: 'abc' }))

      const svc = buildService(m)
      const result = await svc.getById('abc')
      expect(result.id).toBe('abc')
    })
  })

  describe('CR-clients-005 — update() emite client.updated', () => {
    it('actualiza y emite evento con diff (before/after de campos cambiados)', async () => {
      const m = makeMocks()
      const before = buildClient({ id: 'c1', legalName: 'Acme', industry: null })
      const after = { ...before, legalName: 'Acme LLC', industry: 'Construction' }
      m.repo.findById.mockResolvedValueOnce(before)
      m.repo.update.mockResolvedValueOnce(after)

      const svc = buildService(m)
      const result = await svc.update(
        'c1',
        { legalName: 'Acme LLC', industry: 'Construction' },
        'admin-uuid',
      )

      expect(result).toEqual(after)
      expect(m.repo.update).toHaveBeenCalledWith('c1', {
        legalName: 'Acme LLC',
        industry: 'Construction',
      })
      expect(m.events.log).toHaveBeenCalledWith(
        'client.updated',
        expect.objectContaining({
          clientId: 'c1',
          changedFields: expect.arrayContaining(['legalName', 'industry']),
        }),
        'admin-uuid',
        { type: 'client', id: 'c1' },
      )
    })
  })

  describe('CR-clients-006 — update() lanza ClientNotFoundError', () => {
    it('si findById retorna null, lanza antes de update', async () => {
      const m = makeMocks()
      m.repo.findById.mockResolvedValueOnce(null)

      const svc = buildService(m)
      await expect(svc.update('missing', { legalName: 'x' }, 'admin')).rejects.toBeInstanceOf(
        ClientNotFoundError,
      )
      expect(m.repo.update).not.toHaveBeenCalled()
    })
  })

  describe('CR-clients-007 — changeStatus() emite client.status_changed', () => {
    it('actualiza status y emite evento con fromStatus/toStatus', async () => {
      const m = makeMocks()
      const before = buildClient({ id: 'c1', status: 'active' })
      const after = { ...before, status: 'paused' as const }
      m.repo.findById.mockResolvedValueOnce(before)
      m.repo.update.mockResolvedValueOnce(after)

      const svc = buildService(m)
      const result = await svc.changeStatus('c1', 'paused', 'admin-uuid')

      expect(result.status).toBe('paused')
      expect(m.repo.update).toHaveBeenCalledWith('c1', { status: 'paused' })
      expect(m.events.log).toHaveBeenCalledWith(
        'client.status_changed',
        { clientId: 'c1', fromStatus: 'active', toStatus: 'paused' },
        'admin-uuid',
        { type: 'client', id: 'c1' },
      )
    })

    it('si nuevo status === actual, no llama update ni emite', async () => {
      const m = makeMocks()
      m.repo.findById.mockResolvedValueOnce(buildClient({ id: 'c1', status: 'active' }))

      const svc = buildService(m)
      await svc.changeStatus('c1', 'active', 'admin-uuid')

      expect(m.repo.update).not.toHaveBeenCalled()
      expect(m.events.log).not.toHaveBeenCalled()
    })
  })
})
