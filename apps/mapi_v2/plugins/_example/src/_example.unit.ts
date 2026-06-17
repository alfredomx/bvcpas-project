import type { ModuleDef } from '@/registry/module-def'
import { ExampleModule } from './_example.module'
import { exampleConfigSchema } from './_example.config'

/**
 * Manifiesto de la unit de ejemplo. Es la prueba viva de que el registro:
 * 1. monta el `module` (expone `GET /v1/_example/ping`), y
 * 2. valida la `config` Zod al boot.
 *
 * Se reemplaza cuando entre `plugins/intuit` (el primer plugin real).
 */
export const exampleUnit: ModuleDef = {
  name: '_example',
  type: 'plugin',
  module: ExampleModule,
  config: exampleConfigSchema,
}
