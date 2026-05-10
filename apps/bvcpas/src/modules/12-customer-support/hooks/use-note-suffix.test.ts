// Tests del hook useNoteSuffix (v0.5.5, Bloque C).
// Lee y escribe en localStorage el texto adjunto que el operador
// personaliza. D-bvcpas-043.

import { describe, expect, it, beforeEach } from 'vitest'

import { getNoteSuffix, setNoteSuffix, buildNotePreview } from './use-note-suffix'

const KEY = 'bvcpas.noteSuffix'
const DEFAULT = ' - as per client\'s notes'

describe('getNoteSuffix', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('returns the default when nothing is stored', () => {
    expect(getNoteSuffix()).toBe(DEFAULT)
  })

  it('returns the stored value', () => {
    window.localStorage.setItem(KEY, ' - per client approval')
    expect(getNoteSuffix()).toBe(' - per client approval')
  })
})

describe('setNoteSuffix', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('persists the value in localStorage', () => {
    setNoteSuffix(' - custom suffix')
    expect(window.localStorage.getItem(KEY)).toBe(' - custom suffix')
  })
})

describe('buildNotePreview', () => {
  it('appends suffix and date to the note', () => {
    const now = new Date('2026-05-10T12:00:00Z')
    const result = buildNotePreview('office supplies', DEFAULT, now)
    expect(result).toBe("office supplies - as per client's notes (05-10-2026)")
  })

  it('returns empty string when note is empty', () => {
    const now = new Date('2026-05-10T12:00:00Z')
    expect(buildNotePreview('', DEFAULT, now)).toBe('')
  })

  it('trims the note before building', () => {
    const now = new Date('2026-05-10T12:00:00Z')
    const result = buildNotePreview('  office supplies  ', DEFAULT, now)
    expect(result).toBe("office supplies - as per client's notes (05-10-2026)")
  })
})
