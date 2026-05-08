import { CloverApiKeyProvider } from '../../../../src/modules/21-connections/providers/clover/clover-api-key.provider'
import type { DecryptedApiKeyConnection } from '../../../../src/db/schema/user-connections'
import {
  ConnectionAuthError,
  CredentialsShapeError,
} from '../../../../src/modules/21-connections/connection.errors'

/**
 * Tests Tipo A para CloverApiKeyProvider (v0.11.0).
 *
 * Cobertura:
 * - CR-conn-072: validateCredentials acepta {api_token, merchant_id} válidos.
 * - CR-conn-073: validateCredentials lanza CredentialsShapeError si falta campo.
 * - CR-conn-074: fetchMerchant llama /v3/merchants/:id?expand=owner y mapea.
 * - CR-conn-075: fetchMerchant 401 → ConnectionAuthError.
 * - CR-conn-076: test() delega a fetchMerchant con merchant_id de credentials.
 */

const baseConn: DecryptedApiKeyConnection = {
  id: 'conn-clover-1',
  userId: 'u-1',
  provider: 'clover',
  externalAccountId: 'PAJP696WWFWA1',
  clientId: 'bvcpas-client-1',
  scopeType: 'full',
  email: 'owner@restaurant.com',
  label: 'LA Zarzamora',
  credentials: { api_token: 'AT', merchant_id: 'PAJP696WWFWA1' },
}

function buildProvider(fetchFn: jest.Mock): CloverApiKeyProvider {
  return new CloverApiKeyProvider(fetchFn)
}

describe('CloverApiKeyProvider', () => {
  describe('CR-conn-072 — validateCredentials OK', () => {
    it('acepta {api_token, merchant_id} válidos', () => {
      const provider = buildProvider(jest.fn())
      const result = provider.validateCredentials({
        api_token: 'tok',
        merchant_id: 'M1',
      })
      expect(result).toEqual({ apiToken: 'tok', merchantId: 'M1' })
    })
  })

  describe('CR-conn-073 — validateCredentials falla', () => {
    it('falta api_token → CredentialsShapeError', () => {
      const provider = buildProvider(jest.fn())
      expect(() => provider.validateCredentials({ merchant_id: 'M1' })).toThrow(
        CredentialsShapeError,
      )
    })
    it('api_token vacío → CredentialsShapeError', () => {
      const provider = buildProvider(jest.fn())
      expect(() => provider.validateCredentials({ api_token: '', merchant_id: 'M1' })).toThrow(
        CredentialsShapeError,
      )
    })
    it('falta merchant_id → CredentialsShapeError', () => {
      const provider = buildProvider(jest.fn())
      expect(() => provider.validateCredentials({ api_token: 'tok' })).toThrow(
        CredentialsShapeError,
      )
    })
    it('api_token no-string → CredentialsShapeError', () => {
      const provider = buildProvider(jest.fn())
      expect(() => provider.validateCredentials({ api_token: 123, merchant_id: 'M1' })).toThrow(
        CredentialsShapeError,
      )
    })
  })

  describe('CR-conn-074 — fetchMerchant', () => {
    it('llama /v3/merchants/:id?expand=owner y mapea', async () => {
      const fetchFn = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'PAJP696WWFWA1',
          name: 'LA Zarzamora',
          owner: { email: 'owner@x.com', name: 'Owner' },
        }),
      })
      const result = await buildProvider(fetchFn).fetchMerchant('AT', 'PAJP696WWFWA1')
      const [url, init] = fetchFn.mock.calls[0]
      expect(url).toBe('https://api.clover.com/v3/merchants/PAJP696WWFWA1?expand=owner')
      expect((init as RequestInit).headers).toMatchObject({ Authorization: 'Bearer AT' })
      expect(result).toEqual({
        id: 'PAJP696WWFWA1',
        name: 'LA Zarzamora',
        ownerEmail: 'owner@x.com',
      })
    })

    it('si owner falta → ownerEmail null', async () => {
      const fetchFn = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'M1', name: 'Foo' }),
      })
      const result = await buildProvider(fetchFn).fetchMerchant('AT', 'M1')
      expect(result.ownerEmail).toBeNull()
    })
  })

  describe('CR-conn-075 — fetchMerchant 401', () => {
    it('lanza ConnectionAuthError', async () => {
      const fetchFn = jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      })
      await expect(buildProvider(fetchFn).fetchMerchant('AT', 'M1')).rejects.toBeInstanceOf(
        ConnectionAuthError,
      )
    })
  })

  describe('CR-conn-076 — test()', () => {
    it('valida credentials y delega a fetchMerchant', async () => {
      const fetchFn = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'PAJP696WWFWA1', name: 'LA Zarzamora' }),
      })
      const result = await buildProvider(fetchFn).test(baseConn)
      const [url] = fetchFn.mock.calls[0]
      expect(url).toContain('/v3/merchants/PAJP696WWFWA1')
      expect(result.ok).toBe(true)
      expect(result.message).toContain('LA Zarzamora')
    })

    it('credentials inválidas → CredentialsShapeError', async () => {
      const fetchFn = jest.fn()
      const conn: DecryptedApiKeyConnection = {
        ...baseConn,
        credentials: { merchant_id: 'M1' }, // falta api_token
      }
      await expect(buildProvider(fetchFn).test(conn)).rejects.toBeInstanceOf(CredentialsShapeError)
      expect(fetchFn).not.toHaveBeenCalled()
    })
  })
})
