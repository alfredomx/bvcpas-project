// Tests retroactivos del mapeador de errores (v0.2.1, Bloque 3b).

import { describe, expect, it } from 'vitest'

import { ApiError } from '@/lib/http'
import { mapErrorMessage } from './map-error-message'

describe('mapErrorMessage', () => {
  it('returns "Invalid email or password." for INVALID_CREDENTIALS', () => {
    const err = new ApiError(401, 'INVALID_CREDENTIALS', 'Credenciales inválidas')
    expect(mapErrorMessage(err)).toBe('Invalid email or password.')
  })

  it('returns disabled message for USER_DISABLED', () => {
    const err = new ApiError(401, 'USER_DISABLED', 'Usuario inactivo')
    expect(mapErrorMessage(err)).toBe('Your account is disabled. Contact your firm admin.')
  })

  it('returns "session expired" for SESSION_REVOKED', () => {
    const err = new ApiError(401, 'SESSION_REVOKED', 'revocada')
    expect(mapErrorMessage(err)).toBe('Your session expired. Sign in again.')
  })

  it('returns "session expired" for SESSION_EXPIRED', () => {
    const err = new ApiError(401, 'SESSION_EXPIRED', 'expirada')
    expect(mapErrorMessage(err)).toBe('Your session expired. Sign in again.')
  })

  it('returns generic message for unknown code', () => {
    const err = new ApiError(500, 'WEIRD_ERROR_CODE', 'algo raro')
    expect(mapErrorMessage(err)).toBe('Could not sign in. Try again.')
  })

  it('returns generic message when error is not ApiError', () => {
    expect(mapErrorMessage(new Error('network failure'))).toBe('Could not sign in. Try again.')
    expect(mapErrorMessage(null)).toBe('Could not sign in. Try again.')
    expect(mapErrorMessage(undefined)).toBe('Could not sign in. Try again.')
    expect(mapErrorMessage('string error')).toBe('Could not sign in. Try again.')
  })
})
