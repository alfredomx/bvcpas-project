import { ConnectionsService } from '../../../src/modules/21-connections/connections.service'
import type { ConnectionsRepository } from '../../../src/modules/21-connections/connections.repository'
import type {
  ConnectionAccessRepository,
  ShareWithUser,
} from '../../../src/modules/21-connections/connection-access.repository'
import type { EncryptionService } from '../../../src/core/encryption/encryption.service'
import {
  ConnectionNotFoundError,
  ConnectionNotOwnerError,
  ConnectionShareDuplicateError,
  ConnectionShareNotFoundError,
  ConnectionShareSelfError,
  ConnectionShareTargetUserNotFoundError,
} from '../../../src/modules/21-connections/connection.errors'
import type { UserConnection } from '../../../src/db/schema/user-connections'

/**
 * Tests Tipo A para ConnectionsService — métodos de sharing (v0.10.0).
 *
 * Cobertura:
 * - CR-conn-064: share() inserta y devuelve ShareWithUser; lanza si no es dueño.
 * - CR-conn-065: share() lanza ConnectionShareSelfError si target == owner.
 * - CR-conn-066: share() lanza ConnectionShareDuplicateError si ya existe row.
 * - CR-conn-067: updateSharePermission() actualiza si dueño, lanza si no existe row.
 * - CR-conn-068: revokeShare() borra; lanza si no existe row.
 * - CR-conn-069: listShares() devuelve lista; lanza si no es dueño.
 */

const NOW = new Date('2026-05-08T12:00:00Z')

function buildConnection(overrides: Partial<UserConnection> = {}): UserConnection {
  return {
    id: 'conn-1',
    userId: 'owner-user',
    provider: 'dropbox',
    externalAccountId: 'dbid:abc',
    clientId: null,
    scopeType: 'full',
    authType: 'oauth',
    email: 'a@b.com',
    label: null,
    scopes: 'files.metadata.read',
    accessTokenEncrypted: 'enc:AT',
    refreshTokenEncrypted: 'enc:RT',
    accessTokenExpiresAt: new Date(NOW.getTime() + 60_000),
    refreshTokenExpiresAt: null,
    credentialsEncrypted: null,
    lastRefreshedAt: null,
    metadata: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}

function buildShare(overrides: Partial<ShareWithUser> = {}): ShareWithUser {
  return {
    connectionId: 'conn-1',
    userId: 'invited-user',
    permission: 'read',
    createdAt: NOW,
    updatedAt: NOW,
    user: { id: 'invited-user', email: 'inv@b.com', fullName: 'Invited User' },
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
    findById: jest.fn(),
  } as unknown as jest.Mocked<ConnectionsRepository>

  const accessRepo = {
    findByConnectionAndUser: jest.fn().mockResolvedValue(null),
    listByConnection: jest.fn().mockResolvedValue([]),
    insert: jest.fn(),
    updatePermission: jest.fn(),
    delete: jest.fn(),
    userExists: jest.fn().mockResolvedValue(true),
  } as unknown as jest.Mocked<ConnectionAccessRepository>

  const enc = {
    encrypt: jest.fn(),
    decrypt: jest.fn(),
  } as unknown as jest.Mocked<EncryptionService>

  return { repo, accessRepo, enc }
}

function buildService(m: Mocks): ConnectionsService {
  return new ConnectionsService(m.repo, m.accessRepo, m.enc)
}

describe('ConnectionsService — sharing (v0.10.0)', () => {
  describe('CR-conn-064 — share()', () => {
    it('inserta y devuelve ShareWithUser cuando el actor es dueño', async () => {
      const m = makeMocks()
      m.repo.findById.mockResolvedValueOnce(buildConnection())
      m.accessRepo.findByConnectionAndUser.mockResolvedValueOnce(null)
      m.accessRepo.listByConnection.mockResolvedValueOnce([buildShare({ permission: 'write' })])

      const svc = buildService(m)
      const result = await svc.share('conn-1', 'owner-user', 'invited-user', 'write')

      expect(m.accessRepo.insert).toHaveBeenCalledWith('conn-1', 'invited-user', 'write')
      expect(result.userId).toBe('invited-user')
      expect(result.permission).toBe('write')
    })

    it('lanza ConnectionNotOwnerError si actor no es dueño', async () => {
      const m = makeMocks()
      m.repo.findById.mockResolvedValueOnce(buildConnection({ userId: 'other-user' }))
      const svc = buildService(m)

      await expect(svc.share('conn-1', 'wrong', 'invited', 'read')).rejects.toBeInstanceOf(
        ConnectionNotOwnerError,
      )
      expect(m.accessRepo.insert).not.toHaveBeenCalled()
    })

    it('lanza ConnectionNotFoundError si conexión no existe', async () => {
      const m = makeMocks()
      m.repo.findById.mockResolvedValueOnce(null)
      const svc = buildService(m)

      await expect(svc.share('conn-x', 'u', 'i', 'read')).rejects.toBeInstanceOf(
        ConnectionNotFoundError,
      )
    })
  })

  describe('CR-conn-065 — share self', () => {
    it('lanza ConnectionShareSelfError si target_user == actor', async () => {
      const m = makeMocks()
      m.repo.findById.mockResolvedValueOnce(buildConnection())
      const svc = buildService(m)

      await expect(svc.share('conn-1', 'owner-user', 'owner-user', 'read')).rejects.toBeInstanceOf(
        ConnectionShareSelfError,
      )
    })
  })

  describe('CR-conn-066b — share target user inexistente', () => {
    it('lanza ConnectionShareTargetUserNotFoundError si target user no existe', async () => {
      const m = makeMocks()
      m.repo.findById.mockResolvedValueOnce(buildConnection())
      m.accessRepo.userExists.mockResolvedValueOnce(false)
      const svc = buildService(m)

      await expect(svc.share('conn-1', 'owner-user', 'ghost', 'read')).rejects.toBeInstanceOf(
        ConnectionShareTargetUserNotFoundError,
      )
      expect(m.accessRepo.insert).not.toHaveBeenCalled()
    })
  })

  describe('CR-conn-066 — share duplicate', () => {
    it('lanza ConnectionShareDuplicateError si ya existe row', async () => {
      const m = makeMocks()
      m.repo.findById.mockResolvedValueOnce(buildConnection())
      m.accessRepo.findByConnectionAndUser.mockResolvedValueOnce({
        connectionId: 'conn-1',
        userId: 'invited-user',
        permission: 'read',
        createdAt: NOW,
        updatedAt: NOW,
      })
      const svc = buildService(m)

      await expect(
        svc.share('conn-1', 'owner-user', 'invited-user', 'write'),
      ).rejects.toBeInstanceOf(ConnectionShareDuplicateError)
      expect(m.accessRepo.insert).not.toHaveBeenCalled()
    })
  })

  describe('CR-conn-067 — updateSharePermission', () => {
    it('actualiza si dueño y row existe', async () => {
      const m = makeMocks()
      m.repo.findById.mockResolvedValueOnce(buildConnection())
      m.accessRepo.updatePermission.mockResolvedValueOnce({
        connectionId: 'conn-1',
        userId: 'invited-user',
        permission: 'write',
        createdAt: NOW,
        updatedAt: NOW,
      })
      m.accessRepo.listByConnection.mockResolvedValueOnce([buildShare({ permission: 'write' })])
      const svc = buildService(m)

      const result = await svc.updateSharePermission(
        'conn-1',
        'owner-user',
        'invited-user',
        'write',
      )
      expect(result.permission).toBe('write')
    })

    it('lanza ConnectionShareNotFoundError si row no existe', async () => {
      const m = makeMocks()
      m.repo.findById.mockResolvedValueOnce(buildConnection())
      m.accessRepo.updatePermission.mockResolvedValueOnce(null)
      const svc = buildService(m)

      await expect(
        svc.updateSharePermission('conn-1', 'owner-user', 'inv', 'write'),
      ).rejects.toBeInstanceOf(ConnectionShareNotFoundError)
    })
  })

  describe('CR-conn-068 — revokeShare', () => {
    it('borra si dueño y row existe', async () => {
      const m = makeMocks()
      m.repo.findById.mockResolvedValueOnce(buildConnection())
      m.accessRepo.delete.mockResolvedValueOnce(true)
      const svc = buildService(m)

      await svc.revokeShare('conn-1', 'owner-user', 'invited-user')
      expect(m.accessRepo.delete).toHaveBeenCalledWith('conn-1', 'invited-user')
    })

    it('lanza ConnectionShareNotFoundError si row no existe', async () => {
      const m = makeMocks()
      m.repo.findById.mockResolvedValueOnce(buildConnection())
      m.accessRepo.delete.mockResolvedValueOnce(false)
      const svc = buildService(m)

      await expect(svc.revokeShare('conn-1', 'owner-user', 'inv')).rejects.toBeInstanceOf(
        ConnectionShareNotFoundError,
      )
    })
  })

  describe('CR-conn-069 — listShares', () => {
    it('devuelve lista cuando actor es dueño', async () => {
      const m = makeMocks()
      m.repo.findById.mockResolvedValueOnce(buildConnection())
      m.accessRepo.listByConnection.mockResolvedValueOnce([
        buildShare({ userId: 'u1' }),
        buildShare({ userId: 'u2', permission: 'write' }),
      ])
      const svc = buildService(m)

      const result = await svc.listShares('conn-1', 'owner-user')
      expect(result).toHaveLength(2)
    })

    it('lanza ConnectionNotOwnerError si actor no es dueño', async () => {
      const m = makeMocks()
      m.repo.findById.mockResolvedValueOnce(buildConnection({ userId: 'other' }))
      const svc = buildService(m)

      await expect(svc.listShares('conn-1', 'not-owner')).rejects.toBeInstanceOf(
        ConnectionNotOwnerError,
      )
    })
  })

  describe('CR-conn-070 — getDecryptedForWriteByIdForUser', () => {
    it('permite acceso a dueño', async () => {
      const m = makeMocks()
      m.repo.findById.mockResolvedValueOnce(buildConnection())
      m.enc.decrypt.mockReturnValue('plain')
      const svc = buildService(m)

      const result = await svc.getDecryptedForWriteByIdForUser('conn-1', 'owner-user')
      expect(result.id).toBe('conn-1')
    })

    it('permite acceso a shared con permission=write', async () => {
      const m = makeMocks()
      m.repo.findById.mockResolvedValueOnce(buildConnection({ userId: 'other-user' }))
      m.accessRepo.findByConnectionAndUser.mockResolvedValueOnce({
        connectionId: 'conn-1',
        userId: 'invited',
        permission: 'write',
        createdAt: NOW,
        updatedAt: NOW,
      })
      m.enc.decrypt.mockReturnValue('plain')
      const svc = buildService(m)

      const result = await svc.getDecryptedForWriteByIdForUser('conn-1', 'invited')
      expect(result.id).toBe('conn-1')
    })

    it('rechaza shared con permission=read', async () => {
      const m = makeMocks()
      m.repo.findById.mockResolvedValueOnce(buildConnection({ userId: 'other-user' }))
      m.accessRepo.findByConnectionAndUser.mockResolvedValueOnce({
        connectionId: 'conn-1',
        userId: 'invited',
        permission: 'read',
        createdAt: NOW,
        updatedAt: NOW,
      })
      const svc = buildService(m)

      await expect(svc.getDecryptedForWriteByIdForUser('conn-1', 'invited')).rejects.toBeInstanceOf(
        ConnectionNotFoundError,
      )
    })
  })
})
