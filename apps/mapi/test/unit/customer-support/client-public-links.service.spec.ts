import { ClientPublicLinksService } from '../../../src/modules/12-customer-support/public-links/client-public-links.service'
import type { ClientPublicLinksRepository } from '../../../src/modules/12-customer-support/public-links/client-public-links.repository'
import type { EventLogService } from '../../../src/modules/95-event-log/event-log.service'
import {
  PublicLinkExpiredError,
  PublicLinkInvalidError,
  PublicLinkPurposeMismatchError,
  PublicLinkRevokedError,
} from '../../../src/modules/12-customer-support/customer-support.errors'
import type { ClientPublicLink } from '../../../src/db/schema/client-public-links'

/**
 * Tests Tipo A para ClientPublicLinksService.
 *
 * Cobertura:
 * - CR-cs-030: createOrGet idempotente — si existe activo del mismo purpose, lo retorna.
 * - CR-cs-031: createOrGet con force=true revoca el actual y crea nuevo.
 * - CR-cs-032: validateToken lanza PublicLinkInvalidError si token no existe.
 * - CR-cs-033: validateToken lanza PublicLinkRevokedError si revokedAt != null.
 * - CR-cs-034: validateToken lanza PublicLinkExpiredError si expiresAt en pasado.
 * - CR-cs-035: validateToken lanza PublicLinkExpiredError si max_uses agotado.
 * - CR-cs-036: validateToken lanza PublicLinkPurposeMismatchError si purpose no coincide.
 * - CR-cs-037: validateToken válido incrementa useCount y retorna info.
 * - CR-cs-038: revoke marca revokedAt y emite evento.
 */

const NOW = new Date()
const FUTURE = new Date(Date.now() + 100 * 24 * 3600 * 1000)
const PAST = new Date(Date.now() - 1000)

function buildLink(overrides: Partial<ClientPublicLink> = {}): ClientPublicLink {
  return {
    id: 'link-1',
    clientId: 'c-1',
    token: 'tok-abc',
    purpose: 'uncats',
    expiresAt: null,
    revokedAt: null,
    maxUses: null,
    useCount: 0,
    lastUsedAt: null,
    metadata: null,
    createdAt: NOW,
    createdByUserId: 'admin-1',
    ...overrides,
  }
}

interface Mocks {
  repo: jest.Mocked<ClientPublicLinksRepository>
  events: { log: jest.Mock }
}

function makeMocks(): Mocks {
  return {
    repo: {
      findActiveByClientAndPurpose: jest.fn(),
      findByToken: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      revoke: jest.fn(),
      incrementUseCount: jest.fn(),
      listByClient: jest.fn(),
    } as unknown as jest.Mocked<ClientPublicLinksRepository>,
    events: { log: jest.fn().mockResolvedValue(undefined) },
  }
}

function buildService(m: Mocks): ClientPublicLinksService {
  return new ClientPublicLinksService(m.repo, m.events as unknown as EventLogService)
}

describe('ClientPublicLinksService', () => {
  describe('CR-cs-030 — createOrGet idempotente', () => {
    it('si existe activo, lo retorna sin crear nuevo', async () => {
      const m = makeMocks()
      const existing = buildLink()
      m.repo.findActiveByClientAndPurpose.mockResolvedValueOnce(existing)

      const svc = buildService(m)
      const result = await svc.createOrGet('c-1', 'uncats', 'admin-1')

      expect(result).toBe(existing)
      expect(m.repo.create).not.toHaveBeenCalled()
    })

    it('si no existe, crea uno nuevo', async () => {
      const m = makeMocks()
      m.repo.findActiveByClientAndPurpose.mockResolvedValueOnce(null)
      m.repo.create.mockResolvedValueOnce(buildLink())

      const svc = buildService(m)
      await svc.createOrGet('c-1', 'uncats', 'admin-1')

      expect(m.repo.create).toHaveBeenCalledTimes(1)
      const arg = m.repo.create.mock.calls[0]?.[0]
      expect(arg?.clientId).toBe('c-1')
      expect(arg?.purpose).toBe('uncats')
      expect(arg?.token).toMatch(/^[a-f0-9]{64}$/) // 32 bytes hex
    })
  })

  describe('CR-cs-031 — createOrGet con force=true', () => {
    it('revoca el activo actual y crea nuevo', async () => {
      const m = makeMocks()
      const existing = buildLink()
      m.repo.findActiveByClientAndPurpose.mockResolvedValueOnce(existing)
      m.repo.create.mockResolvedValueOnce(buildLink({ id: 'link-2', token: 'tok-2' }))

      const svc = buildService(m)
      await svc.createOrGet('c-1', 'uncats', 'admin-1', { force: true })

      expect(m.repo.revoke).toHaveBeenCalledWith('link-1')
      expect(m.repo.create).toHaveBeenCalledTimes(1)
    })
  })

  describe('CR-cs-032 — token invalid', () => {
    it('lanza PublicLinkInvalidError si findByToken retorna null', async () => {
      const m = makeMocks()
      m.repo.findByToken.mockResolvedValueOnce(null)

      const svc = buildService(m)
      await expect(svc.validateToken('not-existing', 'uncats')).rejects.toBeInstanceOf(
        PublicLinkInvalidError,
      )
    })
  })

  describe('CR-cs-033 — token revocado', () => {
    it('lanza PublicLinkRevokedError', async () => {
      const m = makeMocks()
      m.repo.findByToken.mockResolvedValueOnce(buildLink({ revokedAt: NOW }))

      const svc = buildService(m)
      await expect(svc.validateToken('tok-abc', 'uncats')).rejects.toBeInstanceOf(
        PublicLinkRevokedError,
      )
    })
  })

  describe('CR-cs-034 — token expirado', () => {
    it('lanza PublicLinkExpiredError si expiresAt < now', async () => {
      const m = makeMocks()
      m.repo.findByToken.mockResolvedValueOnce(buildLink({ expiresAt: PAST }))

      const svc = buildService(m)
      await expect(svc.validateToken('tok-abc', 'uncats')).rejects.toBeInstanceOf(
        PublicLinkExpiredError,
      )
    })
  })

  describe('CR-cs-035 — max_uses agotado', () => {
    it('lanza PublicLinkExpiredError si useCount >= maxUses', async () => {
      const m = makeMocks()
      m.repo.findByToken.mockResolvedValueOnce(buildLink({ maxUses: 3, useCount: 3 }))

      const svc = buildService(m)
      await expect(svc.validateToken('tok-abc', 'uncats')).rejects.toBeInstanceOf(
        PublicLinkExpiredError,
      )
    })
  })

  describe('CR-cs-036 — purpose mismatch', () => {
    it('lanza PublicLinkPurposeMismatchError si purpose != requiredPurpose', async () => {
      const m = makeMocks()
      // purpose es 'uncats' (único valor válido en v0.6.0). Para forzar mismatch
      // simulamos un valor distinto via cast.
      m.repo.findByToken.mockResolvedValueOnce(buildLink({ purpose: 'other' as never }))

      const svc = buildService(m)
      await expect(svc.validateToken('tok-abc', 'uncats')).rejects.toBeInstanceOf(
        PublicLinkPurposeMismatchError,
      )
    })
  })

  describe('CR-cs-037 — validate exitoso', () => {
    it('incrementa use_count y retorna info', async () => {
      const m = makeMocks()
      m.repo.findByToken.mockResolvedValueOnce(buildLink({ expiresAt: FUTURE, maxUses: 100 }))

      const svc = buildService(m)
      const result = await svc.validateToken('tok-abc', 'uncats')

      expect(result.clientId).toBe('c-1')
      expect(result.purpose).toBe('uncats')
      expect(m.repo.incrementUseCount).toHaveBeenCalledWith('link-1')
    })
  })

  describe('CR-cs-038 — revoke', () => {
    it('marca revokedAt y emite evento', async () => {
      const m = makeMocks()
      m.repo.findById.mockResolvedValueOnce(buildLink())

      const svc = buildService(m)
      await svc.revoke('link-1', 'admin-1')

      expect(m.repo.revoke).toHaveBeenCalledWith('link-1')
      expect(m.events.log).toHaveBeenCalledWith(
        'client_public_link.revoked',
        { clientId: 'c-1', linkId: 'link-1' },
        'admin-1',
        { type: 'client', id: 'c-1' },
      )
    })

    it('lanza PublicLinkInvalidError si el link no existe', async () => {
      const m = makeMocks()
      m.repo.findById.mockResolvedValueOnce(null)

      const svc = buildService(m)
      await expect(svc.revoke('missing', 'admin-1')).rejects.toBeInstanceOf(PublicLinkInvalidError)
    })
  })
})
