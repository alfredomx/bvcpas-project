// Tests retroactivos de session-storage (v0.2.1, Bloque 3a).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { clearSession, readToken, readUser, writeToken, writeUser } from './session-storage'
import type { User } from '../types'

const sampleUser: User = {
  id: 'u-1',
  email: 'a@b.com',
  fullName: 'Test User',
  role: 'admin',
  status: 'active',
}

describe('session-storage', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('reads token after writeToken', () => {
    writeToken('xyz')
    expect(readToken()).toBe('xyz')
  })

  it('clears token + user with clearSession', () => {
    writeToken('xyz')
    writeUser(sampleUser)

    clearSession()

    expect(readToken()).toBeNull()
    expect(readUser()).toBeNull()
  })

  it('readUser returns null when JSON is corrupt', () => {
    // Escribe directo en sessionStorage para simular corrupción.
    window.sessionStorage.setItem('bvcpas.user', '{not json')

    expect(readUser()).toBeNull()
  })

  it('returns null in SSR (no window)', async () => {
    // Reset del cache de módulos + stub window=undefined → re-importar
    // fuerza al módulo a evaluar isBrowser() en el ambiente sin window.
    vi.resetModules()
    vi.stubGlobal('window', undefined)

    const mod = await import('./session-storage')
    expect(mod.readToken()).toBeNull()
    expect(mod.readUser()).toBeNull()
    // Writes son no-op (no lanzan).
    expect(() => mod.writeToken('xyz')).not.toThrow()
    expect(() => mod.clearToken()).not.toThrow()
    expect(() => mod.clearUser()).not.toThrow()
  })
})
