import { IntuitTokensService } from '@plugins/intuit/src/intuit-tokens.service'
import { IntuitRefreshExpiredError, IntuitTokensNotFoundError, IntuitAuthError } from '@plugins/intuit/src/intuit.errors'
import type { IntuitTokensRepository } from '@plugins/intuit/src/intuit-tokens.repository'
import type { EncryptionService } from '@/core/encryption/encryption.service'
import type { IntuitConfigService } from '@plugins/intuit/src/intuit.config'
import type { IntuitTokens } from '@plugins/intuit/src/intuit-tokens.schema'

// Encryption identidad: lo "cifrado" es el texto plano (probamos lógica, no cripto).
const encryption = {
  encrypt: (s: string) => s,
  decrypt: (s: string) => s,
} as EncryptionService

const config = {
  clientId: 'cid',
  clientSecret: 'csecret',
  oauthTokenUrl: 'https://oauth.test/tokens',
} as IntuitConfigService

function row(over: Partial<IntuitTokens> = {}): IntuitTokens {
  return {
    clientId: 'c1',
    realmId: 'realm-1',
    accessTokenEncrypted: 'access-1',
    refreshTokenEncrypted: 'refresh-1',
    accessTokenExpiresAt: new Date(Date.now() + 3600_000),
    refreshTokenExpiresAt: new Date(Date.now() + 8640_000_00),
    needsReauth: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  }
}

function svc(repo: Partial<IntuitTokensRepository>): IntuitTokensService {
  return new IntuitTokensService(repo as IntuitTokensRepository, encryption, config)
}

function fakeFetch(status: number, jsonBody: unknown): jest.Mock {
  return jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => jsonBody,
    text: async () => JSON.stringify(jsonBody),
  })
}

describe('IntuitTokensService', () => {
  it('getValidAccessToken devuelve el access cuando no venció', async () => {
    const repo = { findByClientId: jest.fn().mockResolvedValue(row()) }
    const res = await svc(repo).getValidAccessToken('c1')
    expect(res).toEqual({ accessToken: 'access-1', realmId: 'realm-1' })
  })

  it('getValidAccessToken refresca cuando el access venció', async () => {
    const repo = {
      findByClientId: jest.fn().mockResolvedValue(row({ accessTokenExpiresAt: new Date(Date.now() - 1000) })),
      upsert: jest.fn().mockResolvedValue(undefined),
    }
    global.fetch = fakeFetch(200, {
      access_token: 'new-access',
      refresh_token: 'new-refresh',
      expires_in: 3600,
      x_refresh_token_expires_in: 8640000,
    })
    const res = await svc(repo).getValidAccessToken('c1')
    expect(res.accessToken).toBe('new-access')
    expect(repo.upsert).toHaveBeenCalled()
  })

  it('getValidAccessToken lanza TOKENS_NOT_FOUND si no hay conexión', async () => {
    const repo = { findByClientId: jest.fn().mockResolvedValue(null) }
    await expect(svc(repo).getValidAccessToken('x')).rejects.toBeInstanceOf(IntuitTokensNotFoundError)
  })

  it('refresh lanza REFRESH_EXPIRED si el refresh venció', async () => {
    const repo = {
      findByClientId: jest.fn().mockResolvedValue(row({ refreshTokenExpiresAt: new Date(Date.now() - 1000) })),
      setNeedsReauth: jest.fn().mockResolvedValue(undefined),
    }
    await expect(svc(repo).refresh('c1')).rejects.toBeInstanceOf(IntuitRefreshExpiredError)
  })

  it('refresh lanza AUTH_ERROR si el token endpoint falla', async () => {
    const repo = {
      findByClientId: jest.fn().mockResolvedValue(row()),
      setNeedsReauth: jest.fn().mockResolvedValue(undefined),
    }
    global.fetch = fakeFetch(400, { error: 'invalid_grant' })
    await expect(svc(repo).refresh('c1')).rejects.toBeInstanceOf(IntuitAuthError)
  })
})
