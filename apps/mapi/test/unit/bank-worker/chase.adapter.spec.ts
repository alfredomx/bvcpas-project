import { ChaseAdapter } from '../../../src/modules/22-bank-worker/adapters/chase.adapter'
import type {
  BankFetchExecutor,
  BankFetchRequest,
  FetchResult,
} from '../../../src/modules/22-bank-worker/adapters/bank-fetch.types'
import {
  BankFetchError,
  ChaseAccountNotFoundError,
} from '../../../src/modules/22-bank-worker/bank-worker.errors'

/**
 * Tests Tipo A para ChaseAdapter (port a Design B). Executor mockeado con
 * respuestas canned — NO toca Chase real. Verifican que el port preserva la
 * mecánica: endpoints, headers (x-jpmc-csrf-token NONE), CSRF en body/url,
 * paginación recursiva, guard de count.
 */

interface MockExec {
  exec: BankFetchExecutor
  calls: BankFetchRequest[]
}

function makeExec(handler: (req: BankFetchRequest) => Partial<FetchResult>): MockExec {
  const calls: BankFetchRequest[] = []
  const exec: BankFetchExecutor = {
    fetch: jest.fn(async (req: BankFetchRequest): Promise<FetchResult> => {
      calls.push(req)
      const base: FetchResult = {
        ok: true,
        status: 200,
        headers: {},
        body: '',
        bodyEncoding: 'text',
      }
      return { ...base, ...handler(req) }
    }),
  }
  return { exec, calls }
}

function json(obj: unknown): Partial<FetchResult> {
  return { body: JSON.stringify(obj) }
}

const MENU_TWO = {
  items: [
    { accountId: 123, accountMask: '8250', summaryType: 'DDA', nickname: 'Operating' },
    { accountId: 456, accountMask: '9000', summaryType: 'CARD', nickname: 'Card' },
  ],
}

describe('ChaseAdapter (Design B port)', () => {
  it('getAllAccounts mapea items de menu/list a BankAccount[]', async () => {
    const { exec } = makeExec((req) => {
      if (req.url.includes('/menu/list')) return json(MENU_TWO)
      return {}
    })
    const accounts = await new ChaseAdapter(exec).getAllAccounts()
    expect(accounts).toEqual([
      { id: '123', mask: '8250', type: 'checking', name: 'Operating' },
      { id: '456', mask: '9000', type: 'credit', name: 'Card' },
    ])
  })

  it('getAllAccounts manda x-jpmc-csrf-token: NONE en el header', async () => {
    const { exec, calls } = makeExec((req) =>
      req.url.includes('/menu/list') ? json(MENU_TWO) : {},
    )
    await new ChaseAdapter(exec).getAllAccounts()
    expect(calls[0].headers?.['x-jpmc-csrf-token']).toBe('NONE')
    expect(calls[0].headers?.['x-jpmc-channel']).toBe('id=C30')
    expect(calls[0].headers?.['x-jpmc-client-request-id']).toBeDefined()
  })

  it('getAllAccounts sin items devuelve []', async () => {
    const { exec } = makeExec((req) => (req.url.includes('/menu/list') ? json({}) : {}))
    expect(await new ChaseAdapter(exec).getAllAccounts()).toEqual([])
  })

  it('searchTransactions arma el payload de actividad y convierte fechas MM-DD-YYYY→YYYYMMDD', async () => {
    const { exec, calls } = makeExec((req) => {
      if (req.url.includes('/menu/list')) return json(MENU_TWO)
      if (req.url.includes('/account/activity/dda/list'))
        return json({ result: [{ sequenceNumber: '1', date: '20260301' }] })
      return {}
    })
    const txns = await new ChaseAdapter(exec).searchTransactions(
      '8250',
      '03-01-2026',
      '03-30-2026',
      'CHECK',
    )
    expect(txns).toHaveLength(1)
    const activityCall = calls.find((c) => c.url.includes('/account/activity/dda/list'))!
    expect(activityCall.body).toContain('accountId=123')
    expect(activityCall.body).toContain('transactionType=CHECK_WITHDRAWS')
    expect(activityCall.body).toContain('dateHi=20260330')
    expect(activityCall.body).toContain('dateLo=20260301')
  })

  it('searchTransactions pagina recursivamente con nextPageId/pageId', async () => {
    const { exec, calls } = makeExec((req) => {
      if (req.url.includes('/menu/list')) return json(MENU_TWO)
      if (req.url.includes('/account/activity/dda/list')) {
        const hasPage2 = req.body?.includes('pageId=P2')
        return hasPage2
          ? json({ result: [{ sequenceNumber: '2', date: '20260302' }] })
          : json({ result: [{ sequenceNumber: '1', date: '20260301' }], nextPageId: 'P2' })
      }
      return {}
    })
    const txns = await new ChaseAdapter(exec).searchTransactions(
      '8250',
      '03-01-2026',
      '03-30-2026',
      'DEPOSIT',
    )
    expect(txns.map((t) => (t as { sequenceNumber: string }).sequenceNumber)).toEqual(['1', '2'])
    const activityCalls = calls.filter((c) => c.url.includes('/account/activity/dda/list'))
    expect(activityCalls).toHaveLength(2)
    expect(activityCalls[0].body).not.toContain('pageId')
    expect(activityCalls[1].body).toContain('pageId=P2')
    // type DEPOSIT → transactionType=DEPOSITS
    expect(activityCalls[0].body).toContain('transactionType=DEPOSITS')
  })

  it('searchTransactions con mask inexistente lanza ChaseAccountNotFoundError', async () => {
    const { exec } = makeExec((req) => (req.url.includes('/menu/list') ? json(MENU_TWO) : {}))
    await expect(
      new ChaseAdapter(exec).searchTransactions('0000', '03-01-2026', '03-30-2026', 'CHECK'),
    ).rejects.toBeInstanceOf(ChaseAccountNotFoundError)
  })

  it('downloadTransactions: count→csrf→download; el token va en el body, NONE en el header', async () => {
    const { exec, calls } = makeExec((req) => {
      if (req.url.includes('/menu/list')) return json(MENU_TWO)
      if (req.url.includes('/download/count/dda/list')) return json({ ddaDownloadActivityCount: 5 })
      if (req.url.includes('/csrf/token/list')) return json({ csrfToken: 'TOK123' })
      if (req.url.includes('/download/dda/list')) return { body: 'Date,Amount\n03/01,10.00\n' }
      return {}
    })
    const buf = await new ChaseAdapter(exec).downloadTransactions(
      '8250',
      '03-01-2026',
      '03-30-2026',
      'CSV',
    )
    expect(buf.toString('utf8')).toBe('Date,Amount\n03/01,10.00\n')

    const dl = calls.find((c) => c.url.includes('/download/dda/list'))!
    expect(dl.body).toContain('csrftoken=TOK123')
    expect(dl.body).toContain('downloadType=CSV')
    expect(dl.headers?.['x-jpmc-csrf-token']).toBe('NONE')
    // el token NUNCA viaja como header
    expect(JSON.stringify(dl.headers)).not.toContain('TOK123')
  })

  it('downloadTransactions con count 0 devuelve buffer vacío y NO llama al download', async () => {
    const { exec, calls } = makeExec((req) => {
      if (req.url.includes('/menu/list')) return json(MENU_TWO)
      if (req.url.includes('/download/count/dda/list')) return json({ ddaDownloadActivityCount: 0 })
      return {}
    })
    const buf = await new ChaseAdapter(exec).downloadTransactions(
      '8250',
      '03-01-2026',
      '03-30-2026',
      'CSV',
    )
    expect(buf.length).toBe(0)
    expect(calls.some((c) => c.url.includes('/download/dda/list'))).toBe(false)
    expect(calls.some((c) => c.url.includes('/csrf/token/list'))).toBe(false)
  })

  it('downloadChecks descarga la imagen de cada cheque', async () => {
    const { exec } = makeExec((req) => {
      if (req.url.includes('/menu/list')) return json(MENU_TWO)
      if (req.url.includes('/account/activity/dda/list'))
        return json({ result: [{ sequenceNumber: 'C1', date: '20260301' }] })
      if (req.url.includes('/digital-checks/v1/images'))
        return json({ checkFrontImage: 'FRONT64', checkRearImage: 'REAR64' })
      return {}
    })
    const checks = await new ChaseAdapter(exec).downloadChecks('8250', '03-01-2026', '03-30-2026')
    expect(checks).toEqual([
      {
        sequenceNumber: 'C1',
        type: 'CHECK',
        frontImageBase64: 'FRONT64',
        rearImageBase64: 'REAR64',
      },
    ])
  })

  it('downloadStatements baja el PDF (base64) de los statements en rango', async () => {
    const pdfB64 = Buffer.from('PDFBYTES').toString('base64')
    const { exec } = makeExec((req) => {
      if (req.url.includes('/menu/list')) return json(MENU_TWO)
      if (req.url.includes('/docref/list'))
        return json({ idaldocRefs: [{ documentId: 'DOC1', documentDate: '20260115' }] })
      if (req.url.includes('/dockey/list')) return json({ docKey: 'KEY1' })
      if (req.url.includes('/csrf/token/list')) return json({ csrfToken: 'T' })
      if (req.url.includes('/pdfdoc/'))
        return {
          body: pdfB64,
          bodyEncoding: 'base64',
          headers: { 'content-type': 'application/pdf' },
        }
      return {}
    })
    const stmts = await new ChaseAdapter(exec).downloadStatements('8250', '2026', '1')
    expect(stmts).toHaveLength(1)
    expect(stmts[0]).toEqual({ documentId: 'DOC1', date: '20260115', pdfBase64: pdfB64 })
  })

  it('_assertOk: error de red del plugin → BankFetchError', async () => {
    const { exec } = makeExec((req) =>
      req.url.includes('/menu/list') ? { ok: false, status: 0, error: 'network down' } : {},
    )
    await expect(new ChaseAdapter(exec).getAllAccounts()).rejects.toBeInstanceOf(BankFetchError)
  })

  it('_assertOk: respuesta no-2xx del banco → BankFetchError', async () => {
    const { exec } = makeExec((req) =>
      req.url.includes('/menu/list') ? { ok: false, status: 503 } : {},
    )
    await expect(new ChaseAdapter(exec).getAllAccounts()).rejects.toBeInstanceOf(BankFetchError)
  })
})
