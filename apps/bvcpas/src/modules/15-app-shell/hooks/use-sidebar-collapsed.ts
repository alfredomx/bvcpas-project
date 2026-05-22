'use client'

// Hook que persiste el estado collapsed/expanded de la sidebar en
// localStorage (D-bvcpas-016 implícito; clave estándar del shell).

import { useCallback, useEffect, useState } from 'react'

export const SIDEBAR_COLLAPSED_KEY = 'bvcpas.sidebarCollapsed'
export const SIDEBAR_TOGGLE_EVENT = 'bvcpas:sidebar-toggle'

interface UseSidebarCollapsedReturn {
  collapsed: boolean
  setCollapsed: (value: boolean) => void
}

function readInitial(): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true'
}

export function useSidebarCollapsed(): UseSidebarCollapsedReturn {
  // Inicial desde localStorage si está; si no, expanded.
  const [collapsed, setCollapsedState] = useState<boolean>(() => readInitial())

  useEffect(() => {
    // Sincroniza si la key cambia desde otro tab.
    const onStorage = (e: StorageEvent) => {
      if (e.key === SIDEBAR_COLLAPSED_KEY) {
        setCollapsedState(e.newValue === 'true')
      }
    }
    // Sincroniza otros componentes del MISMO tab — sin esto, sidebar
    // y topbar tienen sus propios useState y no se enteran cuando
    // uno cambia el valor.
    const onToggle = (e: Event) => {
      const ce = e as CustomEvent<boolean>
      if (typeof ce.detail === 'boolean') setCollapsedState(ce.detail)
    }
    window.addEventListener('storage', onStorage)
    window.addEventListener(SIDEBAR_TOGGLE_EVENT, onToggle)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener(SIDEBAR_TOGGLE_EVENT, onToggle)
    }
  }, [])

  const setCollapsed = useCallback((value: boolean) => {
    setCollapsedState(value)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, value ? 'true' : 'false')
      window.dispatchEvent(new CustomEvent(SIDEBAR_TOGGLE_EVENT, { detail: value }))
    }
  }, [])

  return { collapsed, setCollapsed }
}
