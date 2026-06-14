// Ejecutor de operaciones DOM genérico (Design B).
//
// Corre en el content script de la pestaña objetivo (donde hay DOM). Recibe una
// receta de pasos (DATA) de mapi vía bridge y los ejecuta en orden. NO conoce
// bancos: solo sabe `fill` / `click` / `waitFor` / `getText` sobre selectores
// que le dictan. Mantenerlo tonto protege el moat (la lógica vive en mapi).

import type { DomInstruction, DomResult, DomStepResult } from './types'

const DEFAULT_WAIT_MS = 5000
const POLL_MS = 100

/**
 * Setea el valor de un input/textarea usando el setter NATIVO del prototipo y
 * dispara `input`/`change`/`blur`. Lo crítico son los eventos: un `el.value=x`
 * pelón no los dispara y frameworks como React no registran el valor (el submit
 * iría vacío). Validado contra el logon de Chase (D-kiro-B13).
 */
function fill(selector: string, value: string): void {
  const el = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector)
  if (!el) throw new Error(`fill: no encontré "${selector}"`)
  const proto =
    el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
  el.focus()
  if (setter) setter.call(el, value)
  else el.value = value
  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.dispatchEvent(new Event('change', { bubbles: true }))
  el.dispatchEvent(new FocusEvent('blur', { bubbles: true }))
}

function click(selector: string): void {
  const el = document.querySelector<HTMLElement>(selector)
  if (!el) throw new Error(`click: no encontré "${selector}"`)
  el.click()
}

function getText(selector: string): string {
  const el = document.querySelector(selector)
  if (!el) throw new Error(`getText: no encontré "${selector}"`)
  return (el.textContent ?? '').trim()
}

/** Espera a que aparezca un selector (polling). Rechaza al vencer el timeout. */
function waitFor(selector: string, timeoutMs: number = DEFAULT_WAIT_MS): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(selector)) {
      resolve()
      return
    }
    const start = Date.now()
    const id = setInterval(() => {
      if (document.querySelector(selector)) {
        clearInterval(id)
        resolve()
      } else if (Date.now() - start >= timeoutMs) {
        clearInterval(id)
        reject(new Error(`waitFor: timeout esperando "${selector}" (${timeoutMs}ms)`))
      }
    }, POLL_MS)
  })
}

/**
 * Ejecuta una receta de pasos DOM en orden. Nunca lanza: si un paso falla,
 * devuelve `ok:false` con `failedStep` y `error`. Éxito → `ok:true` + results.
 */
export async function executeDom(instruction: DomInstruction): Promise<DomResult> {
  const { requestId, steps } = instruction
  const results: DomStepResult[] = []

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]
    try {
      let value: string | undefined
      switch (step.op) {
        case 'fill':
          fill(step.selector, step.value)
          break
        case 'click':
          click(step.selector)
          break
        case 'waitFor':
          await waitFor(step.selector, step.timeoutMs)
          break
        case 'getText':
          value = getText(step.selector)
          break
      }
      results.push(
        value !== undefined ? { op: step.op, ok: true, value } : { op: step.op, ok: true },
      )
    } catch (err) {
      results.push({ op: step.op, ok: false })
      return {
        requestId,
        ok: false,
        results,
        failedStep: i,
        error: err instanceof Error ? err.message : String(err),
      }
    }
  }

  return { requestId, ok: true, results }
}
