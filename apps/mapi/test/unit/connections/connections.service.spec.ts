import { ConnectionsService } from '../../../src/modules/21-connections/connections.service'
import type { ConnectionsRepository } from '../../../src/modules/21-connections/connections.repository'
import type { EncryptionService } from '../../../src/core/encryption/encryption.service'
import { ConnectionNotFoundError } from '../../../src/modules/21-connections/connection.errors'
import type { UserConnection } from '../../../src/db/schema/user-connections'

/**
 * Tests Tipo A para ConnectionsService. Sin DB ni red.
 *
 * Cobertura:
 * - CR-conn-001: upsert cifra access + refresh con EncryptionService.
 * - CR-conn-002: getDecryptedById descifra y devuelve plaintext.
 * - CR-conn-003: getDecryptedById lanza CONNECTION_NOT_FOUND si no es del user.
 * - CR-conn-004: listByUser({ provider }) filtra y NO devuelve tokens.
 * - CR-conn-005: deleteByIdForUser borra solo si pertenece al user.
 */

const NOW = new Date('2026-05-06T12:00:00Z')
const FUTURE = new Date(NOW.getTime() + 60 * 60 * 1000)

function buildConnection(overrides: Partial<UserConnection> = {}): UserConnection {
  return {
    id: 'conn-1',
    userId: 'user-1',
    provider: 'microsoft',
    externalAccountId: 'msft-uid-abc',
    email: 'bob@example.com',
    label: null,
    scopes: 'Mail.Send User.Read offline_access',
    accessTokenEncrypted: 'enc:access-plain',
    refreshTokenEncrypted: 'enc:refresh-plain',
    accessTokenExpiresAt: FUTURE,
    lastRefreshedAt: null,
    metadata: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}

interface Mocks {
  repo: jest.Mocked<ConnectionsRepository>
  enc: jest.Mocked<EncryptionService>
}

function makeMocks(): Mocks {
  const repo = {
    findByIdForUser: jest.fn(),
    listByUser: jest.fn().mockResolvedValue([]),
    upsert: jest.fn().mockImplementation(async (data) => buildConnection({ ...data })),
    deleteByIdForUser: jest.fn().mockResolvedValue(true),
    updateLabelForUser: jest.fn(),
    updateRefreshed: jest.fn(),
  } as unknown as jest.Mocked<ConnectionsRepository>

  const enc = {
    encrypt: jest.fn((s: string) => `enc:${s}`),
    decrypt: jest.fn((s: string) => s.replace(/^enc:/, '')),
  } as unknown as jest.Mocked<EncryptionService>

  return { repo, enc }
}

function buildService(m: Mocks): ConnectionsService {
  return new ConnectionsService(m.repo, m.enc)
}

describe('ConnectionsService', () => {
  describe('CR-conn-001 — upsert cifra antes de persistir', () => {
    it('llama encrypt para access y refresh y guarda los ciphertexts', async () => {
      const m = makeMocks()
      const svc = buildService(m)

      await svc.upsert({
        userId: 'user-1',
        provider: 'microsoft',
        externalAccountId: 'msft-uid-abc',
        email: 'bob@example.com',
        label: 'Cuenta personal',
        scopes: 'Mail.Send offline_access',
        accessToken: 'access-plain',
        refreshToken: 'refresh-plain',
        accessTokenExpiresAt: FUTURE,
      })

      expect(m.enc.encrypt).toHaveBeenCalledWith('access-plain')
      expect(m.enc.encrypt).toHaveBeenCalledWith('refresh-plain')
      expect(m.repo.upsert).toHaveBeenCalledTimes(1)
      const saved = m.repo.upsert.mock.calls[0]?.[0]
      expect(saved).toMatchObject({
        userId: 'user-1',
        provider: 'microsoft',
        externalAccountId: 'msft-uid-abc',
        email: 'bob@example.com',
        label: 'Cuenta personal',
        scopes: 'Mail.Send offline_access',
        accessTokenEncrypted: 'enc:access-plain',
        refreshTokenEncrypted: 'enc:refresh-plain',
        accessTokenExpiresAt: FUTURE,
      })
    })

    it('refreshToken null se persiste como null sin llamar encrypt', async () => {
      const m = makeMocks()
      const svc = buildService(m)

      await svc.upsert({
        userId: 'user-1',
        provider: 'google',
        externalAccountId: 'g-uid',
        email: 'bob@gmail.com',
        label: null,
        scopes: 'gmail.send',
        accessToken: 'access-plain',
        refreshToken: null,
        accessTokenExpiresAt: FUTURE,
      })

      expect(m.enc.encrypt).toHaveBeenCalledTimes(1)
      expect(m.enc.encrypt).toHaveBeenCalledWith('access-plain')
      const saved = m.repo.upsert.mock.calls[0]?.[0]
      expect(saved?.refreshTokenEncrypted).toBeNull()
    })
  })

  describe('CR-conn-002 — getDecryptedById descifra', () => {
    it('devuelve plaintext en memoria respetando ownership', async () => {
      const m = makeMocks()
      m.repo.findByIdForUser.mockResolvedValueOnce(buildConnection())
      const svc = buildService(m)

      const result = await svc.getDecryptedByIdForUser('conn-1', 'user-1')

      expect(m.repo.findByIdForUser).toHaveBeenCalledWith('conn-1', 'user-1')
      expect(result).toEqual({
        id: 'conn-1',
        userId: 'user-1',
        provider: 'microsoft',
        externalAccountId: 'msft-uid-abc',
        email: 'bob@example.com',
        label: null,
        scopes: 'Mail.Send User.Read offline_access',
        accessToken: 'access-plain',
        refreshToken: 'refresh-plain',
        accessTokenExpiresAt: FUTURE,
      })
      expect(m.enc.decrypt).toHaveBeenCalledWith('enc:access-plain')
      expect(m.enc.decrypt).toHaveBeenCalledWith('enc:refresh-plain')
    })

    it('refresh_token_encrypted null → refreshToken null sin llamar decrypt extra', async () => {
      const m = makeMocks()
      m.repo.findByIdForUser.mockResolvedValueOnce(buildConnection({ refreshTokenEncrypted: null }))
      const svc = buildService(m)

      const result = await svc.getDecryptedByIdForUser('conn-1', 'user-1')

      expect(result.refreshToken).toBeNull()
      expect(m.enc.decrypt).toHaveBeenCalledTimes(1) // solo access
    })
  })

  describe('CR-conn-003 — ownership scoping', () => {
    it('lanza CONNECTION_NOT_FOUND si la connection no es del user', async () => {
      const m = makeMocks()
      m.repo.findByIdForUser.mockResolvedValueOnce(null)
      const svc = buildService(m)

      await expect(svc.getDecryptedByIdForUser('conn-other', 'user-1')).rejects.toBeInstanceOf(
        ConnectionNotFoundError,
      )
    })
  })

  describe('CR-conn-004 — listByUser', () => {
    it('filtra por provider y NO devuelve tokens', async () => {
      const m = makeMocks()
      m.repo.listByUser.mockResolvedValueOnce([
        buildConnection({ id: 'c1', label: 'Personal' }),
        buildConnection({ id: 'c2', externalAccountId: 'msft-uid-2', label: 'Trabajo' }),
      ])
      const svc = buildService(m)

      const result = await svc.listByUser('user-1', { provider: 'microsoft' })

      expect(m.repo.listByUser).toHaveBeenCalledWith('user-1', { provider: 'microsoft' })
      expect(result).toHaveLength(2)
      // No tokens leakeados
      const first = result[0] as unknown as Record<string, unknown>
      expect(first).not.toHaveProperty('accessTokenEncrypted')
      expect(first).not.toHaveProperty('refreshTokenEncrypted')
      expect(first).not.toHaveProperty('accessToken')
      expect(first).not.toHaveProperty('refreshToken')
      // Sí campos públicos
      expect(first).toMatchObject({ id: 'c1', provider: 'microsoft', label: 'Personal' })
    })
  })

  describe('CR-conn-005 — deleteByIdForUser', () => {
    it('borra cuando pertenece al user', async () => {
      const m = makeMocks()
      m.repo.deleteByIdForUser.mockResolvedValueOnce(true)
      const svc = buildService(m)

      await svc.deleteByIdForUser('conn-1', 'user-1')

      expect(m.repo.deleteByIdForUser).toHaveBeenCalledWith('conn-1', 'user-1')
    })

    it('lanza CONNECTION_NOT_FOUND si la connection no era del user', async () => {
      const m = makeMocks()
      m.repo.deleteByIdForUser.mockResolvedValueOnce(false)
      const svc = buildService(m)

      await expect(svc.deleteByIdForUser('conn-other', 'user-1')).rejects.toBeInstanceOf(
        ConnectionNotFoundError,
      )
    })
  })
})
