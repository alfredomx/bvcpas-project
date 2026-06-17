import { IntuitTokensService } from '@plugins/intuit/src/intuit-tokens.service'
import {
  IntuitAuthError,
  IntuitRefreshExpiredError,
} from '@plugins/intuit/src/intuit.errors'
import type { IntuitTokensRepository } from '@plugins/intuit/src/intuit-tokens.repository'
import type { EncryptionService } from '@/core/encryption/encryption.service'
import type { IntuitConfigService } from '@plugins/intuit/src/intuit.config'
import type { IntuitTokens } from '@plugins/intuit/src/intuit-tokens.schema'

const encryption = { encrypt: (s: string) => s, decrypt: (s: string) => s } as EncryptionService
const config = {
  clientId: 'cid',
  clientSecret: 'sec',
  oauthTokenUrl: 'https://oauth.test/tokens',
  redirectUri: 'https://r',
} as IntuitConfigService

const DAY = 24 * 60 * 60 * 1000

function row(over: Partial<IntuitTokens> = {}): IntuitTokens {
  return {
    clientId: 'c1',
    realmId: 'r1',
    accessTokenEncrypted: 'a',
    refreshTokenEncrypted: 'rt',
    accessTokenExpiresAt: new Date(Date.now() + 3600_000),
    refreshTokenExpiresAt: new Date(Date.now() + 90 * DAY),
    needsReauth: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  }
}

function repoMock(over: Partial<IntuitTokensRepository> = {}): IntuitTokensRepository {
  return {
    findByClientId: jest.fn().mockResolvedValue(row()),
    upsert: jest.fn().mockResolvedValue(row()),
    setNeedsReauth: jest.fn().mockResolvedValue(undefined),
    listAll: jest.fn().mockResolvedValue([row()]),
    findByRealmId: jest.fn(),
    deleteByClientId: jest.fn(),
    ...over,
  } as unknown as IntuitTokensRepository
}

function svc(repo: IntuitTokensRepository): IntuitTokensService {
  return new IntuitTokensService(repo, encryption, config)
}

const OK_FETCH = () =>
  jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({
      access_token: 'na',
      refresh_token: 'nr',
      expires_in: 3600,
      x_refresh_token_expires_in: 8640000,
    }),
    text: async () => '',
  })

const BAD_FETCH = () =>
  jest.fn().mockResolvedValue({ ok: false, status: 400, text: async () => 'invalid_grant' })

describe('IntuitTokensService — needs_reauth', () => {
  it('refresh vencido → marca needs_reauth y lanza REFRESH_EXPIRED', async () => {
    const repo = repoMock({
      findByClientId: jest.fn().mockResolvedValue(row({ refreshTokenExpiresAt: new Date(Date.now() - DAY) })),
    })
    await expect(svc(repo).refresh('c1')).rejects.toBeInstanceOf(IntuitRefreshExpiredError)
    expect(repo.setNeedsReauth).toHaveBeenCalledWith('c1', true)
  })

  it('Intuit rechaza el refresh → marca needs_reauth y lanza AUTH_ERROR', async () => {
    global.fetch = BAD_FETCH()
    const repo = repoMock()
    await expect(svc(repo).refresh('c1')).rejects.toBeInstanceOf(IntuitAuthError)
    expect(repo.setNeedsReauth).toHaveBeenCalledWith('c1', true)
  })

  it('refresh exitoso → guarda (limpia flag) y NO marca needs_reauth', async () => {
    global.fetch = OK_FETCH()
    const repo = repoMock()
    await svc(repo).refresh('c1')
    expect(repo.upsert).toHaveBeenCalled()
    expect(repo.setNeedsReauth).not.toHaveBeenCalled()
  })
})

describe('IntuitTokensService.listStatus — status', () => {
  it('deriva ok / expiring_soon / needs_reauth', async () => {
    const repo = repoMock({
      listAll: jest.fn().mockResolvedValue([
        row({ clientId: 'ok', refreshTokenExpiresAt: new Date(Date.now() + 90 * DAY) }),
        row({ clientId: 'soon', refreshTokenExpiresAt: new Date(Date.now() + 5 * DAY) }),
        row({ clientId: 'flag', refreshTokenExpiresAt: new Date(Date.now() + 90 * DAY), needsReauth: true }),
        row({ clientId: 'expired', refreshTokenExpiresAt: new Date(Date.now() - DAY) }),
      ]),
    })
    const byId = Object.fromEntries((await svc(repo).listStatus()).map((s) => [s.clientId, s]))
    expect(byId.ok.status).toBe('ok')
    expect(byId.soon.status).toBe('expiring_soon')
    expect(byId.flag.status).toBe('needs_reauth')
    expect(byId.expired.status).toBe('needs_reauth')
    expect(byId.ok.daysUntilRefreshExpiry).toBeGreaterThanOrEqual(89)
  })
})

describe('IntuitTokensService.refreshAll', () => {
  it('cuenta ok vs fallidos sin lanzar', async () => {
    const repo = repoMock({
      listAll: jest.fn().mockResolvedValue([row({ clientId: 'a' }), row({ clientId: 'b' })]),
    })
    const s = svc(repo)
    jest
      .spyOn(s, 'refresh')
      .mockResolvedValueOnce({ accessToken: 'x', realmId: 'r' })
      .mockRejectedValueOnce(new IntuitRefreshExpiredError('b'))
    const r = await s.refreshAll()
    expect(r).toEqual({ total: 2, refreshed: 1, failed: 1 })
  })
})
