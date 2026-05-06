import { GraphMailService } from '../../../src/modules/21-microsoft-oauth/graph/graph-mail.service'
import type { MicrosoftTokenRefreshService } from '../../../src/modules/21-microsoft-oauth/tokens/microsoft-token-refresh.service'
import { MicrosoftGraphError } from '../../../src/modules/21-microsoft-oauth/microsoft-oauth.errors'

/**
 * Tests Tipo A para GraphMailService.
 *
 * Cobertura:
 * - CR-msft-013: sendMail arma JSON correcto y manda POST a Graph.
 * - CR-msft-014: error 4xx/5xx de Graph → MicrosoftGraphError.
 */

interface Mocks {
  refresh: jest.Mocked<MicrosoftTokenRefreshService>
  fetchFn: jest.Mock
}

function makeMocks(): Mocks {
  const refresh = {
    getValidAccessToken: jest.fn().mockResolvedValue('access-vigente'),
  } as unknown as jest.Mocked<MicrosoftTokenRefreshService>
  return { refresh, fetchFn: jest.fn() }
}

function buildService(m: Mocks): GraphMailService {
  return new GraphMailService(m.refresh, m.fetchFn)
}

describe('GraphMailService', () => {
  describe('CR-msft-013 — sendMail arma payload y request correctos', () => {
    it('POST a /me/sendMail con bearer y JSON Graph-style', async () => {
      const m = makeMocks()
      m.fetchFn.mockResolvedValueOnce({
        ok: true,
        status: 202,
        text: async () => '',
      })
      const svc = buildService(m)

      await svc.sendMail('user-1', {
        to: 'dest@example.com',
        subject: 'Hola',
        body: 'Cuerpo del correo',
      })

      expect(m.refresh.getValidAccessToken).toHaveBeenCalledWith('user-1')
      expect(m.fetchFn).toHaveBeenCalledTimes(1)

      const [url, init] = m.fetchFn.mock.calls[0] ?? []
      expect(url).toBe('https://graph.microsoft.com/v1.0/me/sendMail')
      expect(init?.method).toBe('POST')
      expect(init?.headers).toMatchObject({
        Authorization: 'Bearer access-vigente',
        'Content-Type': 'application/json',
      })

      const payload = JSON.parse(init?.body as string)
      expect(payload).toEqual({
        message: {
          subject: 'Hola',
          body: { contentType: 'Text', content: 'Cuerpo del correo' },
          toRecipients: [{ emailAddress: { address: 'dest@example.com' } }],
        },
        saveToSentItems: true,
      })
    })
  })

  describe('CR-msft-014 — error de Graph', () => {
    it('lanza MicrosoftGraphError si Graph devuelve no-OK', async () => {
      const m = makeMocks()
      m.fetchFn.mockResolvedValueOnce({
        ok: false,
        status: 403,
        text: async () => '{"error":{"code":"ErrorAccessDenied"}}',
      })
      const svc = buildService(m)

      await expect(
        svc.sendMail('user-1', {
          to: 'dest@example.com',
          subject: 'x',
          body: 'y',
        }),
      ).rejects.toBeInstanceOf(MicrosoftGraphError)
    })
  })
})
