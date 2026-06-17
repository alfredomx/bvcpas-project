import { IntuitOauthService } from '@plugins/intuit/src/intuit-oauth.service'
import {
  IntuitRealmConflictError,
  IntuitRealmMismatchError,
  IntuitStateInvalidError,
} from '@plugins/intuit/src/intuit.errors'
import type Redis from 'ioredis'
import type { ClientsService } from '@/modules/11-clients/clients.service'
import type { IntuitConfigService } from '@plugins/intuit/src/intuit.config'
import type { IntuitTokensService } from '@plugins/intuit/src/intuit-tokens.service'
import type { IntuitTokensRepository } from '@plugins/intuit/src/intuit-tokens.repository'

const config = {
  authorizeUrl: 'https://intuit.test/connect/oauth2',
  clientId: 'app-id',
  redirectUri: 'https://r/callback',
} as IntuitConfigService

function build(over: {
  redis?: Partial<Redis>
  tokensRepo?: Partial<IntuitTokensRepository>
  tokens?: Partial<IntuitTokensService>
} = {}) {
  const redis = {
    set: jest.fn().mockResolvedValue('OK'),
    get: jest.fn(),
    del: jest.fn().mockResolvedValue(1),
    ...over.redis,
  } as unknown as Redis
  const clients = { getById: jest.fn().mockResolvedValue({ id: 'c1' }) } as unknown as ClientsService
  const tokens = {
    exchangeCode: jest.fn().mockResolvedValue(undefined),
    ...over.tokens,
  } as unknown as IntuitTokensService
  const tokensRepo = {
    findByClientId: jest.fn().mockResolvedValue(null),
    findByRealmId: jest.fn().mockResolvedValue(null),
    ...over.tokensRepo,
  } as unknown as IntuitTokensRepository
  const svc = new IntuitOauthService(redis, config, clients, tokens, tokensRepo)
  return { svc, redis, clients, tokens, tokensRepo }
}

describe('IntuitOauthService.connect', () => {
  it('cliente nuevo → state sin expectedRealm', async () => {
    const { svc, redis } = build()
    const { authorizeUrl } = await svc.connect('c1')
    expect(authorizeUrl).toContain('state=')
    const stored = JSON.parse((redis.set as jest.Mock).mock.calls[0][1] as string)
    expect(stored).toEqual({ clientId: 'c1', expectedRealm: undefined })
  })

  it('cliente ya conectado → state recuerda su realm (anti-mixup)', async () => {
    const { svc, redis } = build({
      tokensRepo: { findByClientId: jest.fn().mockResolvedValue({ clientId: 'c1', realmId: 'R1' }) },
    })
    await svc.connect('c1')
    const stored = JSON.parse((redis.set as jest.Mock).mock.calls[0][1] as string)
    expect(stored).toEqual({ clientId: 'c1', expectedRealm: 'R1' })
  })
})

describe('IntuitOauthService.callback', () => {
  it('state inválido → STATE_INVALID', async () => {
    const { svc } = build({ redis: { get: jest.fn().mockResolvedValue(null) } })
    await expect(svc.callback('code', 'R1', 'st')).rejects.toBeInstanceOf(IntuitStateInvalidError)
  })

  it('reconnect con otra compañía → REALM_MISMATCH', async () => {
    const { svc, tokens } = build({
      redis: { get: jest.fn().mockResolvedValue(JSON.stringify({ clientId: 'c1', expectedRealm: 'R1' })) },
    })
    await expect(svc.callback('code', 'R2', 'st')).rejects.toBeInstanceOf(IntuitRealmMismatchError)
    expect(tokens.exchangeCode).not.toHaveBeenCalled()
  })

  it('reconnect con la misma compañía → intercambia el code', async () => {
    const { svc, tokens } = build({
      redis: { get: jest.fn().mockResolvedValue(JSON.stringify({ clientId: 'c1', expectedRealm: 'R1' })) },
    })
    const res = await svc.callback('code', 'R1', 'st')
    expect(res).toEqual({ clientId: 'c1', realmId: 'R1' })
    expect(tokens.exchangeCode).toHaveBeenCalledWith('c1', 'R1', 'code')
  })

  it('realm ligado a otro cliente → REALM_CONFLICT', async () => {
    const { svc } = build({
      redis: { get: jest.fn().mockResolvedValue(JSON.stringify({ clientId: 'c1' })) },
      tokensRepo: { findByRealmId: jest.fn().mockResolvedValue({ clientId: 'OTRO', realmId: 'R1' }) },
    })
    await expect(svc.callback('code', 'R1', 'st')).rejects.toBeInstanceOf(IntuitRealmConflictError)
  })

  it('cliente nuevo (sin expectedRealm), realm libre → ok', async () => {
    const { svc, tokens } = build({
      redis: { get: jest.fn().mockResolvedValue(JSON.stringify({ clientId: 'c1' })) },
    })
    await svc.callback('code', 'R9', 'st')
    expect(tokens.exchangeCode).toHaveBeenCalledWith('c1', 'R9', 'code')
  })
})
