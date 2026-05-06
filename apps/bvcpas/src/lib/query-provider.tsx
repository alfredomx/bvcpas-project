'use client'

// Provider client-component para envolver la app con React Query.
// Se monta una sola vez en src/app/layout.tsx (root, D-bvcpas-014).
//
// El QueryClient se crea con useState para que sobreviva a re-renders
// pero no se comparta entre requests SSR (patrón oficial de Tanstack).

import { useState, type ReactNode } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'

import { makeQueryClient } from './query-client'

export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(() => makeQueryClient())
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
