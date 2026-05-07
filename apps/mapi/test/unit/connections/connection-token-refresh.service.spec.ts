import { ConnectionTokenRefreshService } from '../../../src/modules/21-connections/connection-token-refresh.service'
import type { ConnectionsService } from '../../../src/modules/21-connections/connections.service'
import type { ProviderRegistry } from '../../../src/modules/21-connections/provider-registry.service'
import type { IProvider } from '../../../src/modules/21-connections/providers/provider.interface'
import type { DecryptedUserConnection } from '../../../src/db/schema/user-connections'
import { ConnectionRefreshExpiredError } from '../../../src/modules/21-connections/connection.errors'

/**
 * Tests Tipo A para ConnectionTokenRefreshService.
 *
 * Cobertura:
 * - CR-conn-006: getValidAccessToken devuelve access actual si expira en >5min.
 * - CR-conn-007: refresca si expira en ≤5min, persiste nuevos tokens.
 * - CR-conn-008: si provider lanza ConnectionRefreshExpiredError, propaga.
 */

const NOW = new Date('2026-05-06T12:00:00Z')

function buildDecrypted(overrides: Partial<DecryptedUserConnection> = {}): DecryptedUserConnection {
  return {
    id: 'conn-1',
    userId: 'user-1',
    provider: 'microsoft',
    externalAccountId: 'msft-uid-abc',
    clientId: null,
    scopeType: 'full',
    email: 'bob@example.com',
    label: null,
    scopes: 'Mail.Send User.Read offline_access',
    accessToken: 'access-current',
    refreshToken: 'refresh-current',
    accessTokenExpiresAt: new Date(NOW.getTime() + 60 * 60 * 1000), // 1h
    refreshTokenExpiresAt: null,
    ...overrides,
  }
}

interface Mocks {
  connections: jest.Mocked<ConnectionsService>
  registry: jest.Mocked<ProviderRegistry>
  provider: jest.Mocked<IProvider>
}

function makeMocks(): Mocks {
  const provider = {
    name: 'microsoft' as const,
    refresh: jest.fn(),
    getProfile: jest.fn(),
    test: jest.fn(),
  } as unknown as jest.Mocked<IProvider>

  const registry = {
    get: jest.fn().mockReturnValue(provider),
  } as unknown as jest.Mocked<ProviderRegistry>

  const connections = {
    getDecryptedByIdForUser: jest.fn(),
    upsert: jest.fn(),
    listByUser: jest.fn(),
    deleteByIdForUser: jest.fn(),
  } as unknown as jest.Mocked<ConnectionsService>

  return { connections, registry, provider }
}

function buildService(m: Mocks): ConnectionTokenRefreshService {
  return new ConnectionTokenRefreshService(m.connections, m.registry)
}

describe('ConnectionTokenRefreshService', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(NOW)
  })
  afterEach(() => {
    jest.useRealTimers()
  })

  describe('CR-conn-006 — token vigente, no refresh', () => {
    it('devuelve access actual si expira en >5min', async () => {
      const m = makeMocks()
      m.connections.getDecryptedByIdForUser.mockResolvedValueOnce(buildDecrypted())
      const svc = buildService(m)

      const token = await svc.getValidAccessToken('conn-1', 'user-1')

      expect(token).toBe('access-current')
      expect(m.provider.refresh).not.toHaveBeenCalled()
      expect(m.connections.upsert).not.toHaveBeenCalled()
    })
  })

  describe('CR-conn-007 — refresca y persiste', () => {
    it('llama provider.refresh, persiste nuevos tokens via connections.upsert', async () => {
      const m = makeMocks()
      m.connections.getDecryptedByIdForUser.mockResolvedValueOnce(
        buildDecrypted({
          accessTokenExpiresAt: new Date(NOW.getTime() + 2 * 60 * 1000), // 2 min
        }),
      )
      m.provider.refresh.mockResolvedValueOnce({
        accessToken: 'access-new',
        refreshToken: 'refresh-rotated',
        expiresIn: 3600,
        scopes: 'Mail.Send User.Read offline_access',
      })

      const svc = buildService(m)
      const token = await svc.getValidAccessToken('conn-1', 'user-1')

      expect(token).toBe('access-new')
      expect(m.registry.get).toHaveBeenCalledWith('microsoft')
      expect(m.provider.refresh).toHaveBeenCalledWith(
        expect.objectContaining({ refreshToken: 'refresh-current' }),
      )
      expect(m.connections.upsert).toHaveBeenCalledTimes(1)
      const saved = m.connections.upsert.mock.calls[0]?.[0]
      expect(saved).toMatchObject({
        userId: 'user-1',
        provider: 'microsoft',
        externalAccountId: 'msft-uid-abc',
        accessToken: 'access-new',
        refreshToken: 'refresh-rotated',
      })
      expect(saved?.accessTokenExpiresAt.getTime()).toBe(NOW.getTime() + 3600 * 1000)
    })
  })

  describe('CR-conn-008 — refresh expira', () => {
    it('propaga ConnectionRefreshExpiredError si provider lo lanza', async () => {
      const m = makeMocks()
      m.connections.getDecryptedByIdForUser.mockResolvedValueOnce(
        buildDecrypted({
          accessTokenExpiresAt: new Date(NOW.getTime() + 2 * 60 * 1000),
        }),
      )
      m.provider.refresh.mockRejectedValueOnce(new ConnectionRefreshExpiredError('conn-1'))

      const svc = buildService(m)
      await expect(svc.getValidAccessToken('conn-1', 'user-1')).rejects.toBeInstanceOf(
        ConnectionRefreshExpiredError,
      )
    })
  })
})
