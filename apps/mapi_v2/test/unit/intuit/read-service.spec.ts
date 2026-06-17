import { IntuitReadService } from '@plugins/intuit/src/intuit-read.service'
import { IntuitTooManyRecordsError } from '@plugins/intuit/src/intuit.errors'
import type { IntuitApiService } from '@plugins/intuit/src/intuit-api.service'
import type { IntuitTokensService } from '@plugins/intuit/src/intuit-tokens.service'

const tokens = {
  getValidAccessToken: jest.fn().mockResolvedValue({ accessToken: 'a', realmId: 'r' }),
} as unknown as IntuitTokensService

/** Respuesta QBO con `n` filas de Account. */
function page(n: number) {
  return { QueryResponse: { Account: Array.from({ length: n }, (_, i) => ({ Id: String(i) })) } }
}

function svc(call: jest.Mock): IntuitReadService {
  return new IntuitReadService({ call } as unknown as IntuitApiService, tokens)
}

/** Decodifica el query string del path para aserciones legibles. */
function q(call: jest.Mock, i: number): string {
  return decodeURIComponent(call.mock.calls[i][2] as string)
}

describe('IntuitReadService.list — auto-paginado', () => {
  it('página parcial → una sola llamada, devuelve todo', async () => {
    const call = jest.fn().mockResolvedValue(page(42))
    const rows = await svc(call).list('c1', 'Account')
    expect(rows).toHaveLength(42)
    expect(call).toHaveBeenCalledTimes(1)
  })

  it('pagina hasta agotar (1000 + 1000 + 300 = 2300)', async () => {
    const call = jest
      .fn()
      .mockResolvedValueOnce(page(1000))
      .mockResolvedValueOnce(page(1000))
      .mockResolvedValueOnce(page(300))
    const rows = await svc(call).list('c1', 'Account')
    expect(rows).toHaveLength(2300)
    expect(call).toHaveBeenCalledTimes(3)
  })

  it('STARTPOSITION avanza de 1000 en 1000', async () => {
    const call = jest.fn().mockResolvedValueOnce(page(1000)).mockResolvedValueOnce(page(1))
    await svc(call).list('c1', 'Account')
    expect(q(call, 0)).toContain('STARTPOSITION 1 MAXRESULTS 1000')
    expect(q(call, 1)).toContain('STARTPOSITION 1001 MAXRESULTS 1000')
  })

  it('supera el tope (20 páginas llenas) → INTUIT_TOO_MANY_RECORDS, no trunca', async () => {
    const call = jest.fn().mockResolvedValue(page(1000))
    await expect(svc(call).list('c1', 'Account')).rejects.toBeInstanceOf(IntuitTooManyRecordsError)
    expect(call).toHaveBeenCalledTimes(20)
  })

  it('vacío → []', async () => {
    const call = jest.fn().mockResolvedValue({ QueryResponse: {} })
    expect(await svc(call).list('c1', 'Account')).toEqual([])
  })
})

describe('IntuitReadService.list — override manual', () => {
  it('maxResults → una sola página con ese tamaño', async () => {
    const call = jest.fn().mockResolvedValue(page(1000))
    await svc(call).list('c1', 'Account', { maxResults: 50 })
    expect(call).toHaveBeenCalledTimes(1)
    expect(q(call, 0)).toContain('MAXRESULTS 50')
  })

  it('startPosition → una sola página desde esa posición (no auto-pagina)', async () => {
    const call = jest.fn().mockResolvedValue(page(1000))
    await svc(call).list('c1', 'Account', { startPosition: 200 })
    expect(call).toHaveBeenCalledTimes(1)
    expect(q(call, 0)).toContain('STARTPOSITION 200')
  })

  it('maxResults se clampa al máximo de QBO (1000)', async () => {
    const call = jest.fn().mockResolvedValue(page(1))
    await svc(call).list('c1', 'Account', { maxResults: 99999 })
    expect(q(call, 0)).toContain('MAXRESULTS 1000')
  })
})
