import { ChaseAdapter } from '../../../src/modules/22-bank-worker/adapters/chase.adapter'
import type {
  BankFetchExecutor,
  BankFetchRequest,
  FetchResult,
} from '../../../src/modules/22-bank-worker/adapters/bank-fetch.types'
import {
  BankAdapterError,
  BankFetchError,
  ChaseAccountNotFoundError,
} from '../../../src/modules/22-bank-worker/bank-worker.errors'

/**
 * Tests Tipo A para ChaseAdapter (Design B, **primitivas** — D-mapi-BW-021).
 * Executor mockeado con respuestas canned — NO toca Chase real. Verifican que
 * cada primitiva preserva la mecánica: endpoints, headers (x-jpmc-csrf-token
 * NONE), CSRF en body/url, paginación, sin política (loops/rango/latest viven en
 * el service).
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

describe('ChaseAdapter — cuentas / actividad', () => {
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
    expect(txns.map((t) => t.sequenceNumber)).toEqual(['1', '2'])
    const activityCalls = calls.filter((c) => c.url.includes('/account/activity/dda/list'))
    expect(activityCalls).toHaveLength(2)
    expect(activityCalls[0].body).not.toContain('pageId')
    expect(activityCalls[1].body).toContain('pageId=P2')
    expect(activityCalls[0].body).toContain('transactionType=DEPOSITS')
  })

  it('searchTransactions con mask inexistente lanza ChaseAccountNotFoundError', async () => {
    const { exec } = makeExec((req) => (req.url.includes('/menu/list') ? json(MENU_TWO) : {}))
    await expect(
      new ChaseAdapter(exec).searchTransactions('0000', '03-01-2026', '03-30-2026', 'CHECK'),
    ).rejects.toBeInstanceOf(ChaseAccountNotFoundError)
  })
})

describe('ChaseAdapter — primitivas de imagen / depósito', () => {
  it('downloadImage baja la imagen front/rear de un item por su sequence number', async () => {
    const { exec, calls } = makeExec((req) => {
      if (req.url.includes('/menu/list')) return json(MENU_TWO)
      if (req.url.includes('/digital-checks/v1/images'))
        return json({ checkFrontImage: 'F', checkRearImage: 'R' })
      return {}
    })
    const img = await new ChaseAdapter(exec).downloadImage('8250', 'SEQ1', '20260301', 'CHECK')
    expect(img).toEqual({ front: 'F', rear: 'R' })
    const imgCall = calls.find((c) => c.url.includes('/digital-checks/v1/images'))!
    expect(imgCall.url).toContain('sequence-number=SEQ1')
    expect(imgCall.url).toContain('item-type-name=CHECK')
    expect(imgCall.url).toContain('digital-account-identifier=123')
  })

  it('downloadImage sin checkFrontImage → BankAdapterError', async () => {
    const { exec } = makeExec((req) => {
      if (req.url.includes('/menu/list')) return json(MENU_TWO)
      if (req.url.includes('/digital-checks/v1/images')) return json({})
      return {}
    })
    await expect(
      new ChaseAdapter(exec).downloadImage('8250', 'S', '20260301', 'CHECK'),
    ).rejects.toBeInstanceOf(BankAdapterError)
  })

  it('getDepositDetails arma el payload del detalle del depósito', async () => {
    const { exec, calls } = makeExec((req) => {
      if (req.url.includes('/menu/list')) return json(MENU_TWO)
      if (req.url.includes('/detail/deposit/list'))
        return json({
          depositSequenceNumber: 'D1',
          totalDepositAmount: 500,
          depositSlipAvailable: true,
          transactions: [{ sequenceNumber: 'CK', amount: 500 }],
        })
      return {}
    })
    const details = await new ChaseAdapter(exec).getDepositDetails('8250', {
      sequenceNumber: 'D1',
      date: '20260301',
      amount: 500,
    })
    expect(details.depositSlipAvailable).toBe(true)
    expect(details.transactions).toHaveLength(1)
    const call = calls.find((c) => c.url.includes('/detail/deposit/list'))!
    expect(call.body).toContain('accountId=123')
    expect(call.body).toContain('sequenceNumber=D1')
    expect(call.body).toContain('date=20260301')
    expect(call.body).toContain('amount=500')
  })
})

describe('ChaseAdapter — primitivas de statements', () => {
  it('listStatements devuelve metadata (sin PDF); itera yearsBack', async () => {
    const { exec, calls } = makeExec((req) => {
      if (req.url.includes('/menu/list')) return json(MENU_TWO)
      if (req.url.includes('/docref/list')) {
        const isOld = req.body?.includes('MINUS_1')
        return json({
          idaldocRefs: [
            { documentId: isOld ? 'OLD' : 'CUR', documentDate: isOld ? '20250115' : '20260115' },
          ],
        })
      }
      return {}
    })
    const refs = await new ChaseAdapter(exec).listStatements('8250', { yearsBack: 1 })
    expect(refs).toEqual([
      { documentId: 'CUR', date: '20260115' },
      { documentId: 'OLD', date: '20250115' },
    ])
    const docrefCalls = calls.filter((c) => c.url.includes('/docref/list'))
    expect(docrefCalls).toHaveLength(2)
    expect(calls.some((c) => c.url.includes('/pdfdoc/'))).toBe(false)
  })

  it('downloadStatementPdf baja el PDF de 1 statement (docKey + csrf internos)', async () => {
    const pdfB64 = Buffer.from('PDFBYTES').toString('base64')
    const { exec, calls } = makeExec((req) => {
      if (req.url.includes('/menu/list')) return json(MENU_TWO)
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
    const buf = await new ChaseAdapter(exec).downloadStatementPdf('8250', {
      documentId: 'DOC1',
      date: '20260115',
    })
    expect(buf.toString('utf8')).toBe('PDFBYTES')
    const pdfCall = calls.find((c) => c.url.includes('/pdfdoc/'))!
    expect(pdfCall.url).toContain('docKey=KEY1')
    expect(pdfCall.url).toContain('csrftoken=T')
    expect(pdfCall.headers?.['x-jpmc-csrf-token']).toBe('NONE')
  })
})

describe('ChaseAdapter — export / login / errores', () => {
  it('exportTransactions: count→csrf→download; el token va en el body, NONE en el header', async () => {
    const { exec, calls } = makeExec((req) => {
      if (req.url.includes('/menu/list')) return json(MENU_TWO)
      if (req.url.includes('/download/count/dda/list')) return json({ ddaDownloadActivityCount: 5 })
      if (req.url.includes('/csrf/token/list')) return json({ csrfToken: 'TOK123' })
      if (req.url.includes('/download/dda/list')) return { body: 'Date,Amount\n03/01,10.00\n' }
      return {}
    })
    const buf = await new ChaseAdapter(exec).exportTransactions(
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
    expect(JSON.stringify(dl.headers)).not.toContain('TOK123')
  })

  it('exportTransactions con count 0 devuelve buffer vacío y NO llama al download', async () => {
    const { exec, calls } = makeExec((req) => {
      if (req.url.includes('/menu/list')) return json(MENU_TWO)
      if (req.url.includes('/download/count/dda/list')) return json({ ddaDownloadActivityCount: 0 })
      return {}
    })
    const buf = await new ChaseAdapter(exec).exportTransactions(
      '8250',
      '03-01-2026',
      '03-30-2026',
      'CSV',
    )
    expect(buf.length).toBe(0)
    expect(calls.some((c) => c.url.includes('/download/dda/list'))).toBe(false)
    expect(calls.some((c) => c.url.includes('/csrf/token/list'))).toBe(false)
  })

  it('buildLoginRecipe arma la receta del logonbox con las creds (fill user/pass + click)', () => {
    const { exec } = makeExec(() => ({}))
    const recipe = new ChaseAdapter(exec).buildLoginRecipe({
      username: 'alfredo',
      password: 'S3cret',
    })

    expect(recipe.url).toBe('https://secure.chase.com/web/auth/#/logon/logon/chaseOnline')
    expect(recipe.steps).toEqual([
      { op: 'waitFor', selector: '#userId-input-field-input' },
      { op: 'fill', selector: '#userId-input-field-input', value: 'alfredo' },
      { op: 'fill', selector: '#password-input-field-input', value: 'S3cret' },
      { op: 'click', selector: '#signin-button' },
    ])
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
