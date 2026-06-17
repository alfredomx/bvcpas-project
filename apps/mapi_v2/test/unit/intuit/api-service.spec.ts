import { IntuitApiService } from '@plugins/intuit/src/intuit-api.service'
import { IntuitBadRequestError } from '@plugins/intuit/src/intuit.errors'
import type { IntuitTokensService } from '@plugins/intuit/src/intuit-tokens.service'
import type { IntuitConfigService } from '@plugins/intuit/src/intuit.config'

const config = {
  apiBaseUrl: 'https://qbo.test/v3',
  minorVersion: 75,
} as IntuitConfigService

function qboRes(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  } as unknown as Response
}

describe('IntuitApiService', () => {
  it('call exitoso devuelve el JSON de QBO', async () => {
    const tokens = {
      getValidAccessToken: jest.fn().mockResolvedValue({ accessToken: 'a', realmId: 'r' }),
    } as unknown as IntuitTokensService
    global.fetch = jest.fn().mockResolvedValue(qboRes(200, { QueryResponse: { ok: true } }))

    const out = await new IntuitApiService(tokens, config).call('c1', 'GET', '/company/r/companyinfo/r')
    expect(out).toEqual({ QueryResponse: { ok: true } })
  })

  it('en 401 fuerza refresh y reintenta una vez', async () => {
    const tokens = {
      getValidAccessToken: jest.fn().mockResolvedValue({ accessToken: 'old', realmId: 'r' }),
      refresh: jest.fn().mockResolvedValue({ accessToken: 'new', realmId: 'r' }),
    } as unknown as IntuitTokensService
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(qboRes(401, { Fault: 'expired' }))
      .mockResolvedValueOnce(qboRes(200, { ok: 1 }))

    const out = await new IntuitApiService(tokens, config).call('c1', 'GET', '/company/r/query')
    expect(tokens.refresh).toHaveBeenCalledWith('c1')
    expect(out).toEqual({ ok: 1 })
    expect(global.fetch).toHaveBeenCalledTimes(2)
  })

  it('lanza BAD_REQUEST en un 4xx de QBO', async () => {
    const tokens = {
      getValidAccessToken: jest.fn().mockResolvedValue({ accessToken: 'a', realmId: 'r' }),
    } as unknown as IntuitTokensService
    global.fetch = jest.fn().mockResolvedValue(qboRes(400, { Fault: { Error: [] } }))

    await expect(
      new IntuitApiService(tokens, config).call('c1', 'POST', '/company/r/account', { x: 1 }),
    ).rejects.toBeInstanceOf(IntuitBadRequestError)
  })
})
