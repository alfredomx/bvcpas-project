// Mapea errores devueltos por mapi (ApiError) al mensaje en inglés que
// se muestra al usuario en el form de login. Extraído del LoginForm a un
// archivo propio para testabilidad (D-bvcpas-012).

import { ApiError } from '@/lib/http'

const GENERIC_MESSAGE = 'Could not sign in. Try again.'

export function mapErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return GENERIC_MESSAGE
  }
  switch (error.code) {
    case 'INVALID_CREDENTIALS':
      return 'Invalid email or password.'
    case 'USER_DISABLED':
      return 'Your account is disabled. Contact your firm admin.'
    case 'SESSION_REVOKED':
    case 'SESSION_EXPIRED':
      return 'Your session expired. Sign in again.'
    default:
      return GENERIC_MESSAGE
  }
}
