// Helpers para persistir la última tab visitada por cliente.
// Se exponen como funciones puras (no hook con state) porque el caller
// solo lee/escribe en eventos puntuales — no necesita reactividad.

const PREFIX = 'bvcpas.lastTabByClient.'

function isBrowser(): boolean {
  return typeof window !== 'undefined'
}

export function lastTabKey(clientId: string): string {
  return `${PREFIX}${clientId}`
}

export function getLastTab(clientId: string): string | null {
  if (!isBrowser()) return null
  return window.localStorage.getItem(lastTabKey(clientId))
}

export function setLastTab(clientId: string, slug: string): void {
  if (!isBrowser()) return
  window.localStorage.setItem(lastTabKey(clientId), slug)
}
