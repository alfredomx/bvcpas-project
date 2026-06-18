import { BridgeFetchExecutor } from '@plugins/bank-downloader/src/adapters/bridge-fetch-executor'
import type { BridgeCommandPort } from '@/contracts/bridge.port'
import type { BankFetchRequest, FetchResult } from '@plugins/bank-downloader/src/adapters/bank-fetch.types'

const REQ: BankFetchRequest = { method: 'GET', url: 'https://secure.chase.com/svc/rr/docs' }
const OK: FetchResult = { ok: true, status: 200, headers: {}, body: '{}', bodyEncoding: 'text' }
const SAME_ORIGIN_ERR: FetchResult = {
  ok: false,
  status: 0,
  headers: {},
  body: '',
  bodyEncoding: 'text',
  error: 'no hay pestaña same-origin abierta para https://secure.chase.com/svc/rr/docs',
}

function executor(send: jest.Mock): BridgeFetchExecutor {
  const bridge = { send, isPluginConnected: () => true } as unknown as BridgeCommandPort
  const ex = new BridgeFetchExecutor(bridge)
  ex.sleep = () => Promise.resolve() // instantáneo en tests
  return ex
}

describe('BridgeFetchExecutor — same-origin retry', () => {
  it('abre pestaña al origen y reintenta UNA vez ante el error same-origin', async () => {
    const send = jest
      .fn()
      .mockResolvedValueOnce(SAME_ORIGIN_ERR) // 1er execute_fetch falla
      .mockResolvedValueOnce({ tabId: 1 }) // open_tab
      .mockResolvedValueOnce(OK) // reintento ok
    const res = await executor(send).fetch(REQ)

    expect(res).toEqual(OK)
    expect(send).toHaveBeenNthCalledWith(2, {
      type: 'open_tab',
      payload: { url: 'https://secure.chase.com/' },
    })
    expect(send).toHaveBeenCalledTimes(3)
  })

  it('NO reintenta si el fetch sale ok a la primera', async () => {
    const send = jest.fn().mockResolvedValueOnce(OK)
    const res = await executor(send).fetch(REQ)

    expect(res).toEqual(OK)
    expect(send).toHaveBeenCalledTimes(1) // sin open_tab
  })

  it('NO reintenta ante otros errores (no abre pestaña)', async () => {
    const httpErr: FetchResult = { ...OK, ok: false, status: 503, error: 'banco 503' }
    const send = jest.fn().mockResolvedValueOnce(httpErr)
    const res = await executor(send).fetch(REQ)

    expect(res).toEqual(httpErr)
    expect(send).toHaveBeenCalledTimes(1)
  })
})
