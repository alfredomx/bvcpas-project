'use client'

// Hook para el texto adjunto personalizable por operador (D-bvcpas-043).
// Se guarda en localStorage — cero backend, cero sincronización.
// Default: " - as per client's notes".
// Preview final: "{nota}{sufijo} ({MM-DD-YYYY})".

import { useState } from 'react'

const KEY = 'bvcpas.noteSuffix'
const DEFAULT_SUFFIX = " - as per client's notes"

export function getNoteSuffix(): string {
  if (typeof window === 'undefined') return DEFAULT_SUFFIX
  return window.localStorage.getItem(KEY) ?? DEFAULT_SUFFIX
}

export function setNoteSuffix(value: string): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(KEY, value)
}

function formatDate(now: Date): string {
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(now.getUTCDate()).padStart(2, '0')
  const yyyy = now.getUTCFullYear()
  return `${mm}-${dd}-${yyyy}`
}

/** Construye el preview completo: "{nota}{sufijo} ({fecha})". */
export function buildNotePreview(note: string, suffix: string, now = new Date()): string {
  const trimmed = note.trim()
  if (!trimmed) return ''
  return `${trimmed}${suffix} (${formatDate(now)})`
}

/**
 * Construye solo el append text: "{sufijo} ({fecha})".
 * Es lo que se manda al backend en el campo `appended_text` del PATCH.
 * Mapi lo concatena al `client_note` cuando hace writeback a QBO.
 */
export function buildAppendedText(suffix: string, now = new Date()): string {
  return `${suffix} (${formatDate(now)})`
}

/** Hook React: lee/escribe sufijo en localStorage y lo mantiene en estado local. */
export function useNoteSuffix() {
  const [suffix, setSuffixState] = useState<string>(getNoteSuffix)

  const setSuffix = (value: string) => {
    setNoteSuffix(value)
    setSuffixState(value)
  }

  return { suffix, setSuffix }
}
