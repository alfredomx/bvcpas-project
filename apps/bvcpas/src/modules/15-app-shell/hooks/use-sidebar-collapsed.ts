'use client'

// Hook que persiste el estado collapsed/expanded de la sidebar en
// localStorage (D-bvcpas-016 implícito; clave estándar del shell).

import { useCallback, useEffect, useState } from 'react'

export const SIDEBAR_COLLAPSED_KEY = 'bvcpas.sidebarCollapsed'

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

  // Sincroniza si la key cambia desde otro tab (defensive, no crítico).
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === SIDEBAR_COLLAPSED_KEY) {
        setCollapsedState(e.newValue === 'true')
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const setCollapsed = useCallback((value: boolean) => {
    setCollapsedState(value)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, value ? 'true' : 'false')
    }
  }, [])

  return { collapsed, setCollapsed }
}
