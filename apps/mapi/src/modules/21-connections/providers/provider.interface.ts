import type { DecryptedUserConnection, Provider } from '../../../db/schema/user-connections'

/**
 * Resultado de refrescar tokens. El provider devuelve plaintext; el
 * caller (`ConnectionTokenRefreshService`) se encarga de cifrar antes
 * de persistir.
 *
 * `refreshToken` puede ser null si el provider no rota o no incluye
 * uno nuevo en la respuesta. Microsoft rota siempre.
 */
export interface TokenRefreshResult {
  accessToken: string
  refreshToken: string | null
  expiresIn: number // segundos hasta expirar
  scopes: string // space-separated, lo que el provider devolvió
}

/**
 * Perfil del owner de la conexión (post-OAuth o post-refresh).
 * Se usa para poblar `external_account_id` y `email` en la tabla.
 */
export interface ProviderProfile {
  externalAccountId: string
  email: string | null
}

/**
 * Resultado del test() de un provider. Cada provider implementa "test"
 * de forma específica:
 * - Microsoft: manda mail al propio email del usuario.
 * - Google (futuro): list de Drive raíz o profile.
 * - Dropbox (futuro): pide quota.
 *
 * `message` es texto humano para mostrar al usuario en la UI.
 */
export interface TestResult {
  ok: true
  message: string
}

/**
 * Contrato que cada provider implementa. El core del módulo
 * 21-connections solo conoce esta interfaz; nunca llama directo a una
 * API específica.
 */
export interface IProvider {
  readonly name: Provider
  refresh(refreshToken: string): Promise<TokenRefreshResult>
  getProfile(accessToken: string): Promise<ProviderProfile>
  test(connection: DecryptedUserConnection): Promise<TestResult>
}
