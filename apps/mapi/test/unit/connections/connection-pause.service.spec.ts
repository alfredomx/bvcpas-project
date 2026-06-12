import { ConnectionPauseService } from '../../../src/modules/21-connections/pause/connection-pause.service'
import type { ConnectionsRepository } from '../../../src/modules/21-connections/connections.repository'
import type { ConnectionAccessRepository } from '../../../src/modules/21-connections/connection-access.repository'
import type { EventLogService } from '../../../src/modules/95-event-log/event-log.service'
import type { UserConnection } from '../../../src/db/schema/user-connections'
import {
  ConnectionAlreadyPausedError,
  ConnectionNotFoundError,
  ConnectionNotPausedError,
} from '../../../src/modules/21-connections/connection.errors'

/**
 * Tests Tipo A — ConnectionPauseService (v0.14.0).
 *
 * Cobertura:
 * - pause / resume happy path con ownership.
 * - pause con shared write OK.
 * - pause con shared read → ConnectionNotFoundError (no leak).
 * - pause sobre conexión ya pausada → ConnectionAlreadyPausedError.
 * - resume sobre conexión activa → ConnectionNotPausedError.
 * - Emite events correctos.
 * - Conexión inexistente → ConnectionNotFoundError.
 */

const NOW = new Date('2026-05-23T12:00:00Z')

function buildConn(overrides: Partial<UserConnection> = {}): UserConnection {
  return {
    id: 'conn-1',
    userId: 'owner-1',
    provider: 'clover',
    externalAccountId: 'merchant-x',
    clientId: 'client-1',
    scopeType: 'full',
    authType: 'api_key',
    email: null,
    label: 'Blanco To Go',
    scopes: null,
    accessTokenEncrypted: null,
    refreshTokenEncrypted: null,
    accessTokenExpiresAt: null,
    refreshTokenExpiresAt: null,
    credentialsEncrypted: 'enc',
    lastRefreshedAt: null,
    pausedAt: null,
    pausedReason: null,
    metadata: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}

interface Mocks {
  repo: jest.Mocked<ConnectionsRepository>
  accessRepo: jest.Mocked<ConnectionAccessRepository>
  events: jest.Mocked<EventLogService>
}

function makeMocks(): Mocks {
  const repo = {
    findById: jest.fn(),
    setPause: jest.fn(),
    clearPause: jest.fn(),
  } as unknown as jest.Mocked<ConnectionsRepository>
  const accessRepo = {
    findByConnectionAndUser: jest.fn(),
  } as unknown as jest.Mocked<ConnectionAccessRepository>
  const events = {
    log: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<EventLogService>
  return { repo, accessRepo, events }
}

function buildService(m: Mocks): ConnectionPauseService {
  return new ConnectionPauseService(m.repo, m.accessRepo, m.events)
}

describe('ConnectionPauseService', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(NOW)
  })
  afterEach(() => {
    jest.useRealTimers()
  })

  describe('pause', () => {
    it('pausa cuando el actor es dueño', async () => {
      const m = makeMocks()
      m.repo.findById.mockResolvedValueOnce(buildConn())
      const svc = buildService(m)

      await svc.pause('conn-1', 'owner-1', 'cliente en vacaciones')

      expect(m.repo.setPause).toHaveBeenCalledWith(
        'conn-1',
        expect.any(Date),
        'cliente en vacaciones',
      )
      expect(m.events.log).toHaveBeenCalledWith(
        'connection.paused',
        expect.objectContaining({
          connection_id: 'conn-1',
          provider: 'clover',
          reason: 'cliente en vacaciones',
        }),
        'owner-1',
        { type: 'connection', id: 'conn-1' },
      )
    })

    it('pausa cuando el actor tiene share write', async () => {
      const m = makeMocks()
      m.repo.findById.mockResolvedValueOnce(buildConn())
      m.accessRepo.findByConnectionAndUser.mockResolvedValueOnce({
        connectionId: 'conn-1',
        userId: 'shared-user',
        permission: 'write',
        createdAt: NOW,
        updatedAt: NOW,
      })
      const svc = buildService(m)

      await svc.pause('conn-1', 'shared-user', null)

      expect(m.repo.setPause).toHaveBeenCalled()
    })

    it('lanza ConnectionNotFoundError cuando shared con read only', async () => {
      const m = makeMocks()
      m.repo.findById.mockResolvedValueOnce(buildConn())
      m.accessRepo.findByConnectionAndUser.mockResolvedValueOnce({
        connectionId: 'conn-1',
        userId: 'shared-user',
        permission: 'read',
        createdAt: NOW,
        updatedAt: NOW,
      })
      const svc = buildService(m)

      await expect(svc.pause('conn-1', 'shared-user', null)).rejects.toBeInstanceOf(
        ConnectionNotFoundError,
      )
      expect(m.repo.setPause).not.toHaveBeenCalled()
    })

    it('lanza ConnectionAlreadyPausedError si ya está pausada', async () => {
      const m = makeMocks()
      m.repo.findById.mockResolvedValueOnce(buildConn({ pausedAt: new Date(NOW.getTime() - 1000) }))
      const svc = buildService(m)

      await expect(svc.pause('conn-1', 'owner-1', null)).rejects.toBeInstanceOf(
        ConnectionAlreadyPausedError,
      )
      expect(m.repo.setPause).not.toHaveBeenCalled()
    })

    it('lanza ConnectionNotFoundError si conexión no existe', async () => {
      const m = makeMocks()
      m.repo.findById.mockResolvedValueOnce(null)
      const svc = buildService(m)

      await expect(svc.pause('conn-404', 'owner-1', null)).rejects.toBeInstanceOf(
        ConnectionNotFoundError,
      )
    })
  })

  describe('resume', () => {
    it('reanuda cuando estaba pausada', async () => {
      const m = makeMocks()
      m.repo.findById.mockResolvedValueOnce(
        buildConn({ pausedAt: new Date(NOW.getTime() - 1000), pausedReason: 'x' }),
      )
      const svc = buildService(m)

      await svc.resume('conn-1', 'owner-1')

      expect(m.repo.clearPause).toHaveBeenCalledWith('conn-1')
      expect(m.events.log).toHaveBeenCalledWith(
        'connection.resumed',
        expect.objectContaining({ connection_id: 'conn-1', provider: 'clover' }),
        'owner-1',
        { type: 'connection', id: 'conn-1' },
      )
    })

    it('lanza ConnectionNotPausedError si no estaba pausada', async () => {
      const m = makeMocks()
      m.repo.findById.mockResolvedValueOnce(buildConn())
      const svc = buildService(m)

      await expect(svc.resume('conn-1', 'owner-1')).rejects.toBeInstanceOf(ConnectionNotPausedError)
      expect(m.repo.clearPause).not.toHaveBeenCalled()
    })
  })
})
