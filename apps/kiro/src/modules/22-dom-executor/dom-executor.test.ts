import { afterEach, describe, expect, it, vi } from 'vitest'

import { executeDom } from './dom-executor'

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('executeDom — fill', () => {
  it('setea el value y dispara input/change/blur', async () => {
    document.body.innerHTML = '<input id="u" type="text">'
    const input = document.querySelector<HTMLInputElement>('#u')!
    const fired: string[] = []
    input.addEventListener('input', () => fired.push('input'))
    input.addEventListener('change', () => fired.push('change'))
    input.addEventListener('blur', () => fired.push('blur'))

    const res = await executeDom({
      requestId: 'r1',
      steps: [{ op: 'fill', selector: '#u', value: 'hola' }],
    })

    expect(res.ok).toBe(true)
    expect(input.value).toBe('hola')
    expect(fired).toEqual(['input', 'change', 'blur'])
  })

  it('falla con failedStep si el selector no existe', async () => {
    const res = await executeDom({
      requestId: 'r2',
      steps: [{ op: 'fill', selector: '#nope', value: 'x' }],
    })
    expect(res.ok).toBe(false)
    expect(res.failedStep).toBe(0)
    expect(res.error).toContain('#nope')
  })
})

describe('executeDom — click', () => {
  it('invoca el click del elemento', async () => {
    document.body.innerHTML = '<button id="b">Sign in</button>'
    const btn = document.querySelector<HTMLButtonElement>('#b')!
    const spy = vi.fn()
    btn.addEventListener('click', spy)

    const res = await executeDom({ requestId: 'r3', steps: [{ op: 'click', selector: '#b' }] })

    expect(res.ok).toBe(true)
    expect(spy).toHaveBeenCalledTimes(1)
  })
})

describe('executeDom — getText', () => {
  it('devuelve el texto del elemento (trim)', async () => {
    document.body.innerHTML = '<div id="msg">  Enter the code  </div>'
    const res = await executeDom({ requestId: 'r4', steps: [{ op: 'getText', selector: '#msg' }] })
    expect(res.ok).toBe(true)
    expect(res.results[0]).toEqual({ op: 'getText', ok: true, value: 'Enter the code' })
  })
})

describe('executeDom — waitFor', () => {
  it('resuelve si el selector ya existe', async () => {
    document.body.innerHTML = '<div id="ready"></div>'
    const res = await executeDom({
      requestId: 'r5',
      steps: [{ op: 'waitFor', selector: '#ready' }],
    })
    expect(res.ok).toBe(true)
  })

  it('resuelve cuando el selector aparece después', async () => {
    setTimeout(() => {
      document.body.innerHTML = '<div id="late"></div>'
    }, 120)
    const res = await executeDom({
      requestId: 'r6',
      steps: [{ op: 'waitFor', selector: '#late', timeoutMs: 1000 }],
    })
    expect(res.ok).toBe(true)
  })

  it('falla por timeout si nunca aparece', async () => {
    const res = await executeDom({
      requestId: 'r7',
      steps: [{ op: 'waitFor', selector: '#never', timeoutMs: 120 }],
    })
    expect(res.ok).toBe(false)
    expect(res.failedStep).toBe(0)
    expect(res.error).toContain('timeout')
  })
})

describe('executeDom — receta completa (login style)', () => {
  it('ejecuta pasos en orden y detiene en el primer fallo', async () => {
    document.body.innerHTML =
      '<input id="user" type="text"><input id="pass" type="password"><button id="go"></button>'
    const go = document.querySelector<HTMLButtonElement>('#go')!
    const clickSpy = vi.fn()
    go.addEventListener('click', clickSpy)

    const res = await executeDom({
      requestId: 'r8',
      steps: [
        { op: 'fill', selector: '#user', value: 'alfredo' },
        { op: 'fill', selector: '#pass', value: 'secret' },
        { op: 'click', selector: '#go' },
      ],
    })

    expect(res.ok).toBe(true)
    expect(res.results).toHaveLength(3)
    expect(document.querySelector<HTMLInputElement>('#user')!.value).toBe('alfredo')
    expect(document.querySelector<HTMLInputElement>('#pass')!.value).toBe('secret')
    expect(clickSpy).toHaveBeenCalledTimes(1)
  })

  it('si un paso intermedio falla, no ejecuta los siguientes', async () => {
    document.body.innerHTML = '<input id="user" type="text"><button id="go"></button>'
    const go = document.querySelector<HTMLButtonElement>('#go')!
    const clickSpy = vi.fn()
    go.addEventListener('click', clickSpy)

    const res = await executeDom({
      requestId: 'r9',
      steps: [
        { op: 'fill', selector: '#user', value: 'alfredo' },
        { op: 'fill', selector: '#missing', value: 'x' }, // falla aquí
        { op: 'click', selector: '#go' },
      ],
    })

    expect(res.ok).toBe(false)
    expect(res.failedStep).toBe(1)
    expect(res.results).toHaveLength(2) // solo el fill OK + el fill fallido
    expect(clickSpy).not.toHaveBeenCalled() // el click nunca corrió
  })
})
