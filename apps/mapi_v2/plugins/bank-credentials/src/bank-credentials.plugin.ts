import type { ModuleDef } from '@/registry/module-def'
import { BankCredentialsModule } from './bank-credentials.module'

/**
 * Manifiesto del plugin Bank Credentials para el registro del core. Sin
 * `config`: no tiene env vars propias (usa el `EncryptionService` del core).
 */
export const bankCredentialsPlugin: ModuleDef = {
  name: 'bank-credentials',
  type: 'plugin',
  module: BankCredentialsModule,
}
