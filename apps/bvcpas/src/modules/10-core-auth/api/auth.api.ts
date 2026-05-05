// Llamadas a los endpoints /v1/auth/* de mapi.
// Solo wrappers tipados. Lógica de sesión y storage vive en hooks/.

import { httpGet, httpPost } from '@/lib/http'
import type { LoginRequest, LoginResponse, MeResponse } from '../types'

export function login(body: LoginRequest): Promise<LoginResponse> {
  return httpPost<LoginResponse>('/v1/auth/login', body)
}

export function logout(): Promise<void> {
  return httpPost<void>('/v1/auth/logout')
}

export function me(): Promise<MeResponse> {
  return httpGet<MeResponse>('/v1/auth/me')
}
