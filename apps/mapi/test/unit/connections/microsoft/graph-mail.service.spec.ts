import { GraphMailService } from '../../../../src/modules/21-connections/providers/microsoft/graph-mail.service'
import { ProviderApiError } from '../../../../src/modules/21-connections/connection.errors'

/**
 * Tests Tipo A para GraphMailService (provider Microsoft).
 *
 * Cobertura:
 * - CR-conn-015: sendMail arma payload Graph correcto.
 * - CR-conn-016: error 4xx/5xx → ProviderApiError.
 */

interface Mocks {
  fetchFn: jest.Mock
}

function makeMocks(): Mocks {
  return { fetchFn: jest.fn() }
}

function buildService(m: Mocks): GraphMailService {
  return new GraphMailService(m.fetchFn)
}

describe('GraphMailService', () => {
  describe('CR-conn-015 — sendMail arma payload + request correctos', () => {
    it('POST a /me/sendMail con bearer y JSON Graph-style', async () => {
      const m = makeMocks()
      m.fetchFn.mockResolvedValueOnce({ ok: true, status: 202, text: async () => '' })
      const svc = buildService(m)

      await svc.sendMail('access-vigente', {
        to: 'dest@example.com',
        subject: 'Hola',
        body: 'Cuerpo del correo',
      })

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

  describe('CR-conn-016 — error de Graph', () => {
    it('lanza ProviderApiError si Graph devuelve no-OK', async () => {
      const m = makeMocks()
      m.fetchFn.mockResolvedValueOnce({
        ok: false,
        status: 403,
        text: async () => '{"error":{"code":"ErrorAccessDenied"}}',
      })
      const svc = buildService(m)

      await expect(
        svc.sendMail('access-vigente', { to: 'd@e.com', subject: 'x', body: 'y' }),
      ).rejects.toBeInstanceOf(ProviderApiError)
    })
  })
})
