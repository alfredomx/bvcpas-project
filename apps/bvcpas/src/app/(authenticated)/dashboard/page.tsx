'use client'

// Placeholder mínimo de /dashboard para v0.2.0.
// Solo confirma que el flujo de login funciona end-to-end.
// La pantalla real (sidebar + tabs + customer support) entra en v0.3.0.

import { useSession } from '@/modules/10-core-auth/hooks/use-session'

export default function DashboardPlaceholderPage() {
  const { user, logout } = useSession()

  if (!user) return null // El layout ya cubre splash/redirect.

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-start gap-6 px-6 py-12">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-brand-navy">Hello {user.fullName}</h1>
        <p className="mt-1 text-sm text-text-muted">
          You are logged in as <span className="font-semibold">{user.role}</span>.
        </p>
        <p className="mt-1 text-xs text-text-tertiary">
          Email: <span className="font-mono">{user.email}</span>
        </p>
      </div>

      <div className="rounded-lg border border-border-default bg-surface-soft p-4 text-xs text-text-muted">
        This is a placeholder for v0.2.0. The real dashboard (sidebar with clients, topbar with
        avatar menu, tabs per client, Customer Support view) lands in v0.3.0.
      </div>

      <button
        type="button"
        onClick={logout}
        className="rounded-full bg-brand-navy px-5 py-2 text-sm font-semibold text-text-inverse shadow-[0_2px_8px_rgba(26,34,68,0.25)] transition hover:bg-brand-navy-soft hover:shadow-[0_4px_14px_rgba(26,34,68,0.35)]"
      >
        Logout
      </button>
    </main>
  )
}
