// Tests TDD-first de useLastTab (v0.3.0, Bloque 6).
//
// Persistencia de la última tab visitada por cliente en localStorage:
// key `bvcpas.lastTabByClient.<clientId>` con valor = slug.

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { getLastTab, lastTabKey, setLastTab } from './use-last-tab'

describe('useLastTab helpers', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  afterEach(() => {
    window.localStorage.clear()
  })

  describe('lastTabKey', () => {
    it('builds the key with the clientId suffix', () => {
      expect(lastTabKey('c-1')).toBe('bvcpas.lastTabByClient.c-1')
    })
  })

  describe('getLastTab', () => {
    it('returns null when nothing stored for that clientId', () => {
      expect(getLastTab('c-1')).toBeNull()
    })

    it('returns the stored slug', () => {
      window.localStorage.setItem('bvcpas.lastTabByClient.c-1', '1099')
      expect(getLastTab('c-1')).toBe('1099')
    })

    it('does not leak between clients', () => {
      window.localStorage.setItem('bvcpas.lastTabByClient.c-1', '1099')
      expect(getLastTab('c-2')).toBeNull()
    })
  })

  describe('setLastTab', () => {
    it('persists the slug in localStorage', () => {
      setLastTab('c-1', 'reconciliations')
      expect(window.localStorage.getItem('bvcpas.lastTabByClient.c-1')).toBe('reconciliations')
    })

    it('overwrites a previous value', () => {
      setLastTab('c-1', 'w9')
      setLastTab('c-1', '1099')
      expect(getLastTab('c-1')).toBe('1099')
    })
  })
})
