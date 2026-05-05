'use client'

// Sesión global compartida vía React Context.
//
// Decisión: useSession() leía sessionStorage en cada instancia con su
// propio useState. Eso significaba que login() del <LoginForm> y logout()
// de <DashboardPage> NO se enteraban entre sí — cada componente tenía
// estado aislado. Resultado: redirect post-login y post-logout se
// rompían.
//
// Solución: un Provider montado una vez en el root layout. Todas las
// instancias de useSession() leen del mismo estado.

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'

import * as authApi from '../api/auth.api'
import { clearSession, readToken, readUser, writeToken, writeUser } from '../lib/session-storage'
import type { User } from '../types'

interface SessionContextValue {
  user: User | null
  accessToken: string | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<User>
  logout: () => Promise<void>
}

const SessionContext = createContext<SessionContextValue | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)

  // Hidratación inicial: sessionStorage → estado, luego validar con backend.
  useEffect(() => {
    let cancelled = false

    const token = readToken()
    const cachedUser = readUser()

    if (!token) {
      setIsLoading(false)
      return
    }

    if (cachedUser) {
      setUser(cachedUser)
      setAccessToken(token)
    }

    authApi
      .me()
      .then((freshUser) => {
        if (cancelled) return
        setUser(freshUser)
        setAccessToken(token)
        writeUser(freshUser)
      })
      .catch(() => {
        if (cancelled) return
        clearSession()
        setUser(null)
        setAccessToken(null)
      })
      .finally(() => {
        if (cancelled) return
        setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async (email: string, password: string): Promise<User> => {
    const response = await authApi.login({ email, password })
    writeToken(response.accessToken)
    writeUser(response.user)
    setAccessToken(response.accessToken)
    setUser(response.user)
    return response.user
  }, [])

  const logout = useCallback(async (): Promise<void> => {
    try {
      await authApi.logout()
    } catch {
      // Ignoramos errores: igual cerramos sesión local.
    } finally {
      clearSession()
      setUser(null)
      setAccessToken(null)
    }
  }, [])

  return (
    <SessionContext.Provider value={{ user, accessToken, isLoading, login, logout }}>
      {children}
    </SessionContext.Provider>
  )
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext)
  if (!ctx) {
    throw new Error('useSession() must be used within <SessionProvider>')
  }
  return ctx
}
