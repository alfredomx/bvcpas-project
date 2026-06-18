/**
 * Contrato plugin→plugin publicado por el core (D-core-027). El plugin DUEÑO
 * (`bank-credentials`) liga el token a su implementación; el CONSUMIDOR
 * (`bank-downloader`) inyecta el token y NUNCA importa `@plugins/bank-credentials`.
 *
 * Síncrono y chico: dado un `credentialId`, devuelve los secretos descifrados +
 * el nombre del portal (para que el descargador elija el adapter por banco).
 */
export const BANK_CREDENTIALS_PORT = Symbol('BANK_CREDENTIALS_PORT')

export interface DecryptedBankCredential {
  id: string
  clientId: string
  bankPortalId: string
  /** Nombre del portal (catálogo), para resolver banco → adapter. */
  portalName: string
  username: string | null
  password: string | null
  securityQa: string | null
  status: 'active' | 'blocked' | 'closed'
}

export interface BankCredentialsPort {
  /** Credencial con secretos descifrados + nombre del portal. Lanza si no existe. */
  getDecrypted(credentialId: string): Promise<DecryptedBankCredential>
}
