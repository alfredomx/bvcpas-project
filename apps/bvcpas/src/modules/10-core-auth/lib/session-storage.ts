// Wrapper sobre sessionStorage para sesión de auth.
// Único lugar de la app que toca sessionStorage directo (regla del módulo).
//
// Defensa SSR: si window no existe (server component), todos los reads
// devuelven null y los writes son no-op. Así puede importarse desde
// cualquier lado sin crashear el render server-side.

import type { User } from '../types'

const ACCESS_TOKEN_KEY = 'bvcpas.accessToken'
const USER_KEY = 'bvcpas.user'

function isBrowser(): boolean {
  return typeof window !== 'undefined'
}

export function readToken(): string | null {
  if (!isBrowser()) return null
  return window.sessionStorage.getItem(ACCESS_TOKEN_KEY)
}

export function writeToken(token: string): void {
  if (!isBrowser()) return
  window.sessionStorage.setItem(ACCESS_TOKEN_KEY, token)
}

export function clearToken(): void {
  if (!isBrowser()) return
  window.sessionStorage.removeItem(ACCESS_TOKEN_KEY)
}

export function readUser(): User | null {
  if (!isBrowser()) return null
  const raw = window.sessionStorage.getItem(USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as User
  } catch {
    return null
  }
}

export function writeUser(user: User): void {
  if (!isBrowser()) return
  window.sessionStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function clearUser(): void {
  if (!isBrowser()) return
  window.sessionStorage.removeItem(USER_KEY)
}

export function clearSession(): void {
  clearToken()
  clearUser()
}
