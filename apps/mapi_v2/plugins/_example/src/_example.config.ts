import { z } from 'zod'

/**
 * Config (env vars) del plugin `_example`. Igual que el core, el plugin es
 * dueño de su propio Zod. `EXAMPLE_GREETING` lleva `.default()` para que el
 * boot del core NUNCA se rompa por culpa de la unit de ejemplo.
 *
 * El mismo schema se usa en dos lados: aquí (provider para inyección) y en el
 * `ModuleDef.config` (que el registro valida al boot). Un schema, dos usos.
 */
export const exampleConfigSchema = z.object({
  EXAMPLE_GREETING: z.string().default('hola desde _example'),
})

export type ExampleConfig = z.infer<typeof exampleConfigSchema>

/** Token DI para inyectar la config parseada del plugin. */
export const EXAMPLE_CONFIG = Symbol('EXAMPLE_CONFIG')
