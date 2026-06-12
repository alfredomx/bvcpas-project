import { IntegrationsService } from '../../../src/modules/13-views/integrations/integrations.service'
import { ConnectionStatusResolver } from '../../../src/modules/13-views/integrations/connection-status.resolver'
import type { IntegrationsRepository } from '../../../src/modules/13-views/integrations/integrations.repository'
import type { ClientsRepository } from '../../../src/modules/11-clients/clients.repository'
import type { UserConnection } from '../../../src/db/schema/user-connections'
import type { Client } from '../../../src/db/schema/clients'
import { ClientNotFoundError } from '../../../src/modules/11-clients/clients.errors'

/**
 * Tests Tipo A — IntegrationsService (v0.14.0).
 *
 * Cobertura:
 * - getDashboard sin conexiones → stats en 0 y connections vacías.
 * - getDashboard con mix de status → KPIs correctos.
 * - providersInUse cuenta distinct provider (max 2).
 * - Cliente no existe → ClientNotFoundError.
 */

const NOW = new Date('2026-05-23T12:00:00Z')

function buildClient(overrides: Partial<Client> = {}): Client {
  return {
    id: 'client-1',
    legalName: 'Marale, Inc',
    qboRealmId: 'realm-123',
    tier: 'silver',
    status: 'active',
    transactionsFilter: 'all',
    draftEmailEnabled: true,
    ccEmail: null,
    primaryContactName: null,
    primaryContactEmail: null,
    primaryContactPhone: null,
    fiscalYearStart: null,
    notes: null,
    syncStartDate: '2025-01-01',
    syncEnabled: true,
    onboardingStatus: 'ready',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  } as Client
}

function buildConn(overrides: Partial<UserConnection> = {}): UserConnection {
  return {
    id: 'conn-1',
    userId: 'user-1',
    provider: 'square',
    externalAccountId: 'merchant-abc',
    clientId: 'client-1',
    scopeType: 'full',
    authType: 'oauth',
    email: null,
    label: 'Blanco To Go',
    scopes: 'MERCHANT_PROFILE_READ',
    accessTokenEncrypted: 'enc',
    refreshTokenEncrypted: 'enc',
    accessTokenExpiresAt: new Date(NOW.getTime() + 3600 * 1000),
    refreshTokenExpiresAt: new Date(NOW.getTime() + 30 * 24 * 3600 * 1000),
    credentialsEncrypted: null,
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
  repo: jest.Mocked<IntegrationsRepository>
  clientsRepo: jest.Mocked<ClientsRepository>
}

function makeMocks(): Mocks {
  const repo = {
    listByClient: jest.fn(),
  } as unknown as jest.Mocked<IntegrationsRepository>
  const clientsRepo = {
    findById: jest.fn(),
  } as unknown as jest.Mocked<ClientsRepository>
  return { repo, clientsRepo }
}

function buildService(m: Mocks): IntegrationsService {
  return new IntegrationsService(m.repo, m.clientsRepo, new ConnectionStatusResolver())
}

describe('IntegrationsService.getDashboard', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(NOW)
  })
  afterEach(() => {
    jest.useRealTimers()
  })

  it('lanza ClientNotFoundError si el cliente no existe', async () => {
    const m = makeMocks()
    m.clientsRepo.findById.mockResolvedValueOnce(null)
    const svc = buildService(m)

    await expect(svc.getDashboard('client-404')).rejects.toBeInstanceOf(ClientNotFoundError)
    expect(m.repo.listByClient).not.toHaveBeenCalled()
  })

  it('devuelve stats en 0 y connections vacías cuando no hay conexiones', async () => {
    const m = makeMocks()
    m.clientsRepo.findById.mockResolvedValueOnce(buildClient())
    m.repo.listByClient.mockResolvedValueOnce([])
    const svc = buildService(m)

    const result = await svc.getDashboard('client-1')

    expect(result.client).toEqual({ id: 'client-1', legalName: 'Marale, Inc' })
    expect(result.stats).toEqual({
      connected: 0,
      healthy: 0,
      needsAttention: 0,
      errors: 0,
      providersInUse: 0,
    })
    expect(result.connections).toEqual([])
  })

  it('agrega stats correctos con mix de status', async () => {
    const m = makeMocks()
    m.clientsRepo.findById.mockResolvedValueOnce(buildClient())
    m.repo.listByClient.mockResolvedValueOnce([
      buildConn({ id: 'c1', provider: 'square' }), // healthy
      buildConn({
        id: 'c2',
        provider: 'square',
        refreshTokenExpiresAt: new Date(NOW.getTime() - 1000),
      }), // needs_reauth
      buildConn({
        id: 'c3',
        provider: 'clover',
        authType: 'api_key',
        accessTokenEncrypted: null,
        refreshTokenEncrypted: null,
        accessTokenExpiresAt: null,
        refreshTokenExpiresAt: null,
        credentialsEncrypted: 'enc',
        pausedAt: new Date(NOW.getTime() - 1000),
        pausedReason: 'pausa',
      }), // paused
    ])
    const svc = buildService(m)

    const result = await svc.getDashboard('client-1')

    expect(result.stats).toEqual({
      connected: 3,
      healthy: 1,
      needsAttention: 1,
      errors: 1,
      providersInUse: 2, // square + clover
    })
    expect(result.connections).toHaveLength(3)
  })

  it('providersInUse cuenta distinct provider (max 2)', async () => {
    const m = makeMocks()
    m.clientsRepo.findById.mockResolvedValueOnce(buildClient())
    m.repo.listByClient.mockResolvedValueOnce([
      buildConn({ id: 'c1', provider: 'clover', authType: 'api_key', externalAccountId: 'm1' }),
      buildConn({ id: 'c2', provider: 'clover', authType: 'api_key', externalAccountId: 'm2' }),
      buildConn({ id: 'c3', provider: 'clover', authType: 'api_key', externalAccountId: 'm3' }),
    ])
    const svc = buildService(m)

    const result = await svc.getDashboard('client-1')

    expect(result.stats.connected).toBe(3)
    expect(result.stats.providersInUse).toBe(1)
  })

  it('mapea connections con providerLabel correcto', async () => {
    const m = makeMocks()
    m.clientsRepo.findById.mockResolvedValueOnce(buildClient())
    m.repo.listByClient.mockResolvedValueOnce([
      buildConn({
        id: 'c1',
        provider: 'clover',
        authType: 'api_key',
        accessTokenEncrypted: null,
        refreshTokenEncrypted: null,
        accessTokenExpiresAt: null,
        refreshTokenExpiresAt: null,
        credentialsEncrypted: 'enc',
        label: 'Blanco To Go',
      }),
      buildConn({ id: 'c2', provider: 'square', label: 'Square Marale' }),
    ])
    const svc = buildService(m)

    const result = await svc.getDashboard('client-1')

    expect(result.connections[0]).toMatchObject({
      id: 'c1',
      provider: 'clover',
      providerLabel: 'Clover',
      label: 'Blanco To Go',
      authType: 'api_key',
      status: 'healthy',
    })
    expect(result.connections[1]).toMatchObject({
      id: 'c2',
      provider: 'square',
      providerLabel: 'Square',
      authType: 'oauth',
      status: 'healthy',
    })
  })
})
