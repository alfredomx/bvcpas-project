import type { ModuleDef } from '@/registry/module-def'
import { intuitConfigSchema } from './intuit.config'
import { IntuitModule } from './intuit.module'

/**
 * Manifiesto del plugin Intuit para el registro del core. El registro valida
 * `config` (Zod de INTUIT_*) al boot y monta `module`.
 */
export const intuitPlugin: ModuleDef = {
  name: 'intuit',
  type: 'plugin',
  module: IntuitModule,
  config: intuitConfigSchema,
}
