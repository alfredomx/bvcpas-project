import { afterEach, describe, expect, it, vi } from 'vitest'

import { handleRoutedMessage, isRoutedFetchMessage } from './content'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('isRoutedFetchMessage', () => {
  it('reconoce el mensaje ruteado', () => {
    expect(
      isRoutedFetchMessage({
        kind: 'kiro:execute_fetch',
        correlationId: 'a',
        payload: { method: 'GET', url: 'https://x/y' },
      }),
    ).toBe(true)
  })

  it('rechaza mensajes ajenos', () => {
    expect(isRoutedFetchMessage({ kind: 'otra-cosa' })).toBe(false)
    expect(isRoutedFetchMessage(null)).toBe(false)
    expect(isRoutedFetchMessage({ kind: 'kiro:execute_fetch', correlationId: 1 })).toBe(false)
  })
})

describe('handleRoutedMessage', () => {
  it('corre executeFetch con requestId=correlationId y responde el FetchResult', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'text/plain' }),
      text: async () => 'hola',
      arrayBuffer: async () => new ArrayBuffer(0),
    }))
    vi.stubGlobal('fetch', fetchMock)

    const sendResponse = vi.fn()
    const keepOpen = handleRoutedMessage(
      {
        kind: 'kiro:execute_fetch',
        correlationId: 'corr-9',
        payload: { method: 'GET', url: 'https://bank.example/api' },
      },
      {},
      sendResponse,
    )

    // Debe devolver true (respuesta asíncrona).
    expect(keepOpen).toBe(true)
    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalledTimes(1))

    expect(fetchMock).toHaveBeenCalledWith('https://bank.example/api', {
      method: 'GET',
      credentials: 'include',
    })
    const result = sendResponse.mock.calls[0][0]
    expect(result).toMatchObject({ requestId: 'corr-9', ok: true, body: 'hola' })
  })

  it('ignora mensajes que no son del bridge (devuelve false)', () => {
    const sendResponse = vi.fn()
    const keepOpen = handleRoutedMessage({ kind: 'otra' }, {}, sendResponse)
    expect(keepOpen).toBe(false)
    expect(sendResponse).not.toHaveBeenCalled()
  })
})
