'use client'

// Form de /. Replica el diseño de reference/login-navy-v2.html con
// Tailwind v4 + tokens semánticos bvcpas (D-bvcpas-009).
//
// - Validación client-side con Zod (email + password no vacío).
// - Submit llama useSession().login(); on success → router.replace('/dashboard').
// - On ApiError: toast con mensaje mapeado por code.
// - Caps Lock pill mientras se escribe la password.
// - Si ya hay sesión al montar, redirect inmediato a /dashboard.
// - "Forgot password?" y "Contact your firm admin" → toast (D-bvcpas TDD).

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowRight, Lock, Mail } from 'lucide-react'
import { toast } from 'sonner'

import { useSession } from '../hooks/use-session'
import { ApiError } from '@/lib/http'
import { cn } from '@/lib/utils'

const schema = z.object({
  email: z.string().email('Enter a valid email.'),
  password: z.string().min(1, 'Password is required.'),
})

type FormValues = z.infer<typeof schema>

function mapErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.code) {
      case 'INVALID_CREDENTIALS':
        return 'Invalid email or password.'
      case 'USER_DISABLED':
        return 'Your account is disabled. Contact your firm admin.'
      case 'SESSION_REVOKED':
      case 'SESSION_EXPIRED':
        return 'Your session expired. Sign in again.'
      default:
        return 'Could not sign in. Try again.'
    }
  }
  return 'Could not sign in. Try again.'
}

export function LoginForm() {
  const router = useRouter()
  const { user, isLoading, login } = useSession()
  const [showPassword, setShowPassword] = useState(false)
  const [capsOn, setCapsOn] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  })

  // Redirect si ya hay sesión al montar.
  useEffect(() => {
    if (!isLoading && user) {
      router.replace('/dashboard')
    }
  }, [isLoading, user, router])

  // Splash mientras se hidrata desde sessionStorage o si ya hay sesión
  // (mientras router.replace navega). Evita el "flash" del form al
  // recargar estando logueado.
  if (isLoading || user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-canvas">
        <div className="size-6 animate-spin rounded-full border-2 border-border-strong border-t-brand-navy" />
      </div>
    )
  }

  const onSubmit = async (values: FormValues) => {
    try {
      await login(values.email, values.password)
      router.replace('/dashboard')
    } catch (err) {
      toast.error(mapErrorMessage(err))
    }
  }

  const handlePlaceholderToast = () => {
    toast.message('Contact your firm admin.')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-canvas px-4 py-10">
      <div className="relative flex w-full max-w-[480px] flex-col overflow-hidden rounded-2xl border border-border-default bg-surface-canvas px-12 pb-8 pt-10 shadow-[0_12px_32px_rgba(26,34,68,0.08),0_2px_6px_rgba(26,34,68,0.04)]">
        {/* Barra naranja superior */}
        <div className="absolute inset-x-0 top-0 h-[3px] bg-brand-accent" />

        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <div className="relative grid size-8 place-items-center rounded-lg bg-gradient-to-br from-brand-navy to-brand-navy-soft text-[14px] font-bold tracking-tight text-text-inverse shadow-[0_2px_6px_rgba(26,34,68,0.18)]">
            QB
            <span className="absolute inset-x-0 -bottom-[3px] h-[3px] rounded-b-lg bg-brand-accent" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-sm font-semibold tracking-tight text-brand-navy">QB&apos;s</span>
            <span className="text-[11px] font-medium tracking-wide text-text-muted">
              · Internal · BrightPath CPA
            </span>
          </div>
        </div>

        {/* Body */}
        <div className="flex w-full flex-col pt-7">
          <div className="mb-3.5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-brand-navy-soft">
            <span className="size-1.5 rounded-full bg-brand-accent shadow-[0_0_0_3px_rgba(245,158,11,0.18)]" />
            Sign in to continue
          </div>

          <h1 className="mb-2 text-[30px] font-bold leading-[1.15] tracking-tight text-brand-navy">
            Welcome back.
          </h1>
          <p className="mb-7 max-w-[380px] text-[13.5px] leading-relaxed text-text-muted">
            Sign in with your firm credentials to access the QuickBooks triage workspace.
          </p>

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3.5">
            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-xs font-semibold tracking-tight text-brand-navy"
              >
                Work email
              </label>
              <div className="relative flex items-center">
                <Mail className="pointer-events-none absolute left-3 size-4 text-text-tertiary" />
                <input
                  id="email"
                  type="email"
                  placeholder="you@firm.com"
                  autoComplete="email"
                  {...register('email')}
                  className={cn(
                    'h-[42px] w-full rounded-md border bg-surface-soft pl-[38px] pr-3.5 text-[13.5px] text-brand-navy outline-none transition placeholder:text-text-tertiary',
                    'focus:border-brand-navy-soft focus:bg-surface-canvas focus:shadow-[0_0_0_3px_rgba(30,42,82,0.10)]',
                    errors.email ? 'border-status-danger' : 'border-border-strong',
                  )}
                />
              </div>
              {errors.email && (
                <p className="mt-1 text-[11px] text-status-danger">{errors.email.message}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <div className="mb-1.5 flex items-baseline justify-between">
                <label
                  htmlFor="password"
                  className="text-xs font-semibold tracking-tight text-brand-navy"
                >
                  Password
                </label>
                <button
                  type="button"
                  onClick={handlePlaceholderToast}
                  className="text-[11.5px] font-medium text-brand-navy-soft hover:text-brand-accent-strong hover:underline"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative flex items-center">
                <Lock className="pointer-events-none absolute left-3 size-4 text-text-tertiary" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••••••"
                  autoComplete="current-password"
                  {...register('password')}
                  onKeyDown={(e) =>
                    setCapsOn(
                      typeof e.getModifierState === 'function'
                        ? e.getModifierState('CapsLock')
                        : false,
                    )
                  }
                  className={cn(
                    'h-[42px] w-full rounded-md border bg-surface-soft pl-[38px] pr-16 text-[13.5px] text-brand-navy outline-none transition placeholder:text-text-tertiary',
                    'focus:border-brand-navy-soft focus:bg-surface-canvas focus:shadow-[0_0_0_3px_rgba(30,42,82,0.10)]',
                    errors.password ? 'border-status-danger' : 'border-border-strong',
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-2 rounded px-2 py-1.5 text-[11px] font-semibold tracking-wider text-text-muted hover:bg-surface-muted hover:text-brand-navy"
                >
                  {showPassword ? 'HIDE' : 'SHOW'}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-[11px] text-status-danger">{errors.password.message}</p>
              )}
              {capsOn && (
                <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-status-warning-bg px-2.5 py-1 text-[11px] font-semibold text-status-warning">
                  <span aria-hidden>⇪</span>
                  Caps Lock is on
                </div>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className={cn(
                'mt-2 flex h-[46px] w-full items-center justify-center gap-2.5 rounded-full bg-brand-navy text-sm font-semibold text-text-inverse shadow-[0_2px_8px_rgba(26,34,68,0.25)] transition',
                'hover:bg-brand-navy-soft hover:shadow-[0_4px_14px_rgba(26,34,68,0.35)]',
                'active:translate-y-px',
                'disabled:cursor-not-allowed disabled:opacity-60',
              )}
            >
              {isSubmitting ? (
                'Signing in…'
              ) : (
                <>
                  Sign in to QB&apos;s
                  <ArrowRight className="size-3.5 transition group-hover:translate-x-0.5" />
                </>
              )}
            </button>

            <p className="mt-5 text-center text-[12.5px] text-text-muted">
              Trouble signing in?{' '}
              <button
                type="button"
                onClick={handlePlaceholderToast}
                className="font-semibold text-brand-navy hover:text-brand-accent-strong"
              >
                Contact your firm admin
              </button>
            </p>
          </form>
        </div>

        {/* Footer */}
        <div className="mt-auto flex items-center justify-between border-t border-border-soft pt-6 text-[11.5px]">
          <div className="flex gap-[18px]">
            <button
              type="button"
              onClick={handlePlaceholderToast}
              className="font-medium text-text-muted hover:text-brand-navy"
            >
              Privacy
            </button>
            <button
              type="button"
              onClick={handlePlaceholderToast}
              className="font-medium text-text-muted hover:text-brand-navy"
            >
              Terms
            </button>
            <button
              type="button"
              onClick={handlePlaceholderToast}
              className="font-medium text-text-muted hover:text-brand-navy"
            >
              Status
            </button>
          </div>
          <span className="inline-flex items-center gap-1.5 font-mono text-[10.5px] text-text-muted">
            <span className="size-[7px] rounded-full bg-status-success shadow-[0_0_0_3px_rgba(47,143,94,0.18)]" />
            All systems operational
          </span>
        </div>
      </div>
    </div>
  )
}
