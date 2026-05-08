import { ConnectionsService } from '../../../src/modules/21-connections/connections.service'
import type { ConnectionsRepository } from '../../../src/modules/21-connections/connections.repository'
import type { ConnectionAccessRepository } from '../../../src/modules/21-connections/connection-access.repository'
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
    clientId: null,
    scopeType: 'full',
    authType: 'oauth',
    email: 'bob@example.com',
    label: null,
    scopes: 'Mail.Send User.Read offline_access',
    accessTokenEncrypted: 'enc:access-plain',
    refreshTokenEncrypted: 'enc:refresh-plain',
    accessTokenExpiresAt: FUTURE,
    refreshTokenExpiresAt: null,
    credentialsEncrypted: null,
    lastRefreshedAt: null,
    metadata: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}

interface Mocks {
  repo: jest.Mocked<ConnectionsRepository>
  accessRepo: jest.Mocked<ConnectionAccessRepository>
  enc: jest.Mocked<EncryptionService>
}

function makeMocks(): Mocks {
  const repo = {
    findByIdForUser: jest.fn(),
    findById: jest.fn(),
    listByUser: jest.fn().mockResolvedValue([]),
    listVisibleByUser: jest.fn().mockResolvedValue([]),
    upsert: jest.fn().mockImplementation(async (data) => buildConnection({ ...data })),
    deleteByIdForUser: jest.fn().mockResolvedValue(true),
    updateLabelForUser: jest.fn(),
    findActiveForRead: jest.fn(),
    findActiveForWrite: jest.fn(),
  } as unknown as jest.Mocked<ConnectionsRepository>

  const accessRepo = {
    findByConnectionAndUser: jest.fn().mockResolvedValue(null),
    listByConnection: jest.fn().mockResolvedValue([]),
    listConnectionIdsForSharedUser: jest.fn().mockResolvedValue([]),
    insert: jest.fn(),
    updatePermission: jest.fn(),
    delete: jest.fn(),
    userExists: jest.fn().mockResolvedValue(true),
  } as unknown as jest.Mocked<ConnectionAccessRepository>

  const enc = {
    encrypt: jest.fn((s: string) => `enc:${s}`),
    decrypt: jest.fn((s: string) => s.replace(/^enc:/, '')),
  } as unknown as jest.Mocked<EncryptionService>

  return { repo, accessRepo, enc }
}

function buildService(m: Mocks): ConnectionsService {
  return new ConnectionsService(m.repo, m.accessRepo, m.enc)
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
    it('devuelve plaintext en memoria si el user es dueño', async () => {
      const m = makeMocks()
      m.repo.findById.mockResolvedValueOnce(buildConnection())
      const svc = buildService(m)

      const result = await svc.getDecryptedByIdForUser('conn-1', 'user-1')

      expect(m.repo.findById).toHaveBeenCalledWith('conn-1')
      expect(result).toEqual({
        id: 'conn-1',
        userId: 'user-1',
        provider: 'microsoft',
        externalAccountId: 'msft-uid-abc',
        clientId: null,
        scopeType: 'full',
        email: 'bob@example.com',
        label: null,
        scopes: 'Mail.Send User.Read offline_access',
        accessToken: 'access-plain',
        refreshToken: 'refresh-plain',
        accessTokenExpiresAt: FUTURE,
        refreshTokenExpiresAt: null,
      })
      expect(m.enc.decrypt).toHaveBeenCalledWith('enc:access-plain')
      expect(m.enc.decrypt).toHaveBeenCalledWith('enc:refresh-plain')
    })

    it('refresh_token_encrypted null → refreshToken null sin llamar decrypt extra', async () => {
      const m = makeMocks()
      m.repo.findById.mockResolvedValueOnce(buildConnection({ refreshTokenEncrypted: null }))
      const svc = buildService(m)

      const result = await svc.getDecryptedByIdForUser('conn-1', 'user-1')

      expect(result.refreshToken).toBeNull()
      expect(m.enc.decrypt).toHaveBeenCalledTimes(1) // solo access
    })
  })

  describe('CR-conn-003 — ownership scoping', () => {
    it('lanza CONNECTION_NOT_FOUND si la connection no existe', async () => {
      const m = makeMocks()
      m.repo.findById.mockResolvedValueOnce(null)
      const svc = buildService(m)

      await expect(svc.getDecryptedByIdForUser('conn-other', 'user-1')).rejects.toBeInstanceOf(
        ConnectionNotFoundError,
      )
    })

    it('lanza CONNECTION_NOT_FOUND si user no es dueño y no tiene share row', async () => {
      const m = makeMocks()
      m.repo.findById.mockResolvedValueOnce(buildConnection({ userId: 'other-user' }))
      m.accessRepo.findByConnectionAndUser.mockResolvedValueOnce(null)
      const svc = buildService(m)

      await expect(svc.getDecryptedByIdForUser('conn-1', 'user-1')).rejects.toBeInstanceOf(
        ConnectionNotFoundError,
      )
    })
  })

  describe('CR-conn-004 — listByUser', () => {
    it('filtra por provider y NO devuelve tokens; marca propias como owner', async () => {
      const m = makeMocks()
      m.repo.listVisibleByUser.mockResolvedValueOnce([
        buildConnection({ id: 'c1', label: 'Personal' }),
        buildConnection({ id: 'c2', externalAccountId: 'msft-uid-2', label: 'Trabajo' }),
      ])
      const svc = buildService(m)

      const result = await svc.listByUser('user-1', { provider: 'microsoft' })

      expect(m.repo.listVisibleByUser).toHaveBeenCalledWith('user-1', { provider: 'microsoft' })
      expect(result).toHaveLength(2)
      // No tokens leakeados
      const first = result[0] as unknown as Record<string, unknown>
      expect(first).not.toHaveProperty('accessTokenEncrypted')
      expect(first).not.toHaveProperty('refreshTokenEncrypted')
      expect(first).not.toHaveProperty('accessToken')
      expect(first).not.toHaveProperty('refreshToken')
      // Sí campos públicos + accessRole='owner' (las dos son del user-1)
      expect(first).toMatchObject({
        id: 'c1',
        provider: 'microsoft',
        label: 'Personal',
        accessRole: 'owner',
      })
    })

    it('marca rows ajenas como shared-read o shared-write según connection_access', async () => {
      const m = makeMocks()
      m.repo.listVisibleByUser.mockResolvedValueOnce([
        buildConnection({ id: 'c-mine', userId: 'user-1' }),
        buildConnection({ id: 'c-shared-r', userId: 'other-user' }),
        buildConnection({ id: 'c-shared-w', userId: 'other-user' }),
      ])
      m.accessRepo.listConnectionIdsForSharedUser.mockResolvedValueOnce([
        { connectionId: 'c-shared-r', permission: 'read' },
        { connectionId: 'c-shared-w', permission: 'write' },
      ])
      const svc = buildService(m)

      const result = await svc.listByUser('user-1')

      expect(result.find((r) => r.id === 'c-mine')?.accessRole).toBe('owner')
      expect(result.find((r) => r.id === 'c-shared-r')?.accessRole).toBe('shared-read')
      expect(result.find((r) => r.id === 'c-shared-w')?.accessRole).toBe('shared-write')
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

  describe('CR-conn-029 — findActiveForRead delega al repo y descifra', () => {
    it('devuelve plaintext cuando hay row', async () => {
      const m = makeMocks()
      m.repo.findActiveForRead.mockResolvedValueOnce(
        buildConnection({
          id: 'c-read',
          clientId: 'client-x',
          scopeType: 'readonly',
          provider: 'intuit',
        }),
      )
      const svc = buildService(m)

      const result = await svc.findActiveForRead('intuit', 'client-x', 'user-1')

      expect(m.repo.findActiveForRead).toHaveBeenCalledWith('intuit', 'client-x', 'user-1')
      expect(result?.id).toBe('c-read')
      expect(result?.scopeType).toBe('readonly')
      expect(result?.accessToken).toBe('access-plain')
    })

    it('devuelve null cuando no hay row', async () => {
      const m = makeMocks()
      m.repo.findActiveForRead.mockResolvedValueOnce(null)
      const svc = buildService(m)

      const result = await svc.findActiveForRead('intuit', 'client-x', 'user-1')

      expect(result).toBeNull()
    })
  })

  describe('CR-conn-031 — findActiveForWriteOrThrow delega y descifra', () => {
    it('devuelve plaintext cuando hay row personal full', async () => {
      const m = makeMocks()
      m.repo.findActiveForWrite.mockResolvedValueOnce(
        buildConnection({
          id: 'c-write',
          clientId: 'client-x',
          scopeType: 'full',
          provider: 'intuit',
        }),
      )
      const svc = buildService(m)

      const result = await svc.findActiveForWriteOrThrow('intuit', 'client-x', 'user-1')

      expect(m.repo.findActiveForWrite).toHaveBeenCalledWith('intuit', 'client-x', 'user-1')
      expect(result.scopeType).toBe('full')
      expect(result.accessToken).toBe('access-plain')
    })
  })

  describe('CR-conn-032 — findActiveForWriteOrThrow lanza si no hay personal full', () => {
    it('IntuitPersonalConnectionRequiredError (HTTP 403)', async () => {
      const m = makeMocks()
      m.repo.findActiveForWrite.mockResolvedValueOnce(null)
      const svc = buildService(m)

      await expect(
        svc.findActiveForWriteOrThrow('intuit', 'client-x', 'user-1'),
      ).rejects.toMatchObject({ code: 'INTUIT_PERSONAL_CONNECTION_REQUIRED' })
    })
  })

  describe('CR-conn-033 — upsert con clientId y scopeType', () => {
    it('persiste correctamente clientId y scopeType al repo', async () => {
      const m = makeMocks()
      const svc = buildService(m)

      await svc.upsert({
        userId: 'user-1',
        provider: 'intuit',
        externalAccountId: 'realm-9341',
        clientId: 'client-elite',
        scopeType: 'full',
        email: null,
        label: null,
        scopes: 'com.intuit.quickbooks.accounting openid',
        accessToken: 'access-plain',
        refreshToken: 'refresh-plain',
        accessTokenExpiresAt: FUTURE,
        refreshTokenExpiresAt: new Date(FUTURE.getTime() + 100 * 24 * 60 * 60 * 1000),
      })

      const saved = m.repo.upsert.mock.calls[0]?.[0]
      expect(saved).toMatchObject({
        userId: 'user-1',
        provider: 'intuit',
        externalAccountId: 'realm-9341',
        clientId: 'client-elite',
        scopeType: 'full',
      })
      expect(saved?.refreshTokenExpiresAt).toBeInstanceOf(Date)
    })
  })
})
