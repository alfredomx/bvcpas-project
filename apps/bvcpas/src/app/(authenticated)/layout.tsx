'use client'

// Group route layout: protege todas las rutas autenticadas + monta el
// AppShell visual.
//
// Responsabilidades:
// - Mientras useSession hidrata: muestra splash.
// - Sin sesión: redirect a /.
// - Con sesión: renderiza <AppShell>{children}</AppShell>.
// - Listener auth:unauthorized: cierra sesión local + redirect + toast.

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { useSession } from '@/modules/10-core-auth/hooks/use-session'
import { clearSession } from '@/modules/10-core-auth/lib/session-storage'
import { AppShell } from '@/modules/15-app-shell/components/app-shell'

export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { user, isLoading } = useSession()

  // Listener global para 401 disparado desde lib/http.ts.
  useEffect(() => {
    const handler = () => {
      clearSession()
      toast.error('Your session expired. Sign in again.')
      router.replace('/')
    }
    window.addEventListener('auth:unauthorized', handler)
    return () => window.removeEventListener('auth:unauthorized', handler)
  }, [router])

  // Sin sesión tras hidratar: redirect a /.
  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/')
    }
  }, [isLoading, user, router])

  if (isLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-canvas">
        <div className="size-6 animate-spin rounded-full border-2 border-border-strong border-t-brand-navy" />
      </div>
    )
  }

  return <AppShell>{children}</AppShell>
}
