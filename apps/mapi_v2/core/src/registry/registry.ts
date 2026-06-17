import type { DynamicModule, Type } from '@nestjs/common'
import { examplePlugin } from '@plugins/_example/src'
import type { ModuleDef } from './module-def'

/**
 * Lista explícita de los plugins/pipes montados en el core.
 *
 * Cada plugin/pipe se da de alta agregando su `ModuleDef` aquí (una línea,
 * seguible con ctrl-click). El core NUNCA importa un plugin/pipe por nombre
 * fuera de esta lista (regla de oro — ver README raíz). Auto-discovery
 * (escanear `plugins/*`) está diferido al 2º plugin.
 *
 * `_example` es el plugin de prueba (se reemplaza cuando entre `plugins/intuit`).
 */
export const REGISTRY: ModuleDef[] = [examplePlugin]

/**
 * Valida al boot la config (Zod) de cada plugin/pipe contra el env. Junta
 * TODAS las violaciones de TODOS los plugins/pipes y lanza un solo `Error`
 * claro (fail-fast): así un deploy con varias vars faltantes las muestra todas
 * de una, no de a una. Los plugins/pipes sin `config` se omiten.
 *
 * Se llama en `bootstrap()` ANTES de levantar Nest: si algo falta, el proceso
 * muere antes de aceptar tráfico.
 */
export function assertRegistryConfig(defs: readonly ModuleDef[], env: NodeJS.ProcessEnv): void {
  const problems: string[] = []

  for (const def of defs) {
    if (!def.config) continue
    const result = def.config.safeParse(env)
    if (!result.success) {
      for (const issue of result.error.issues) {
        problems.push(`  - [${def.name}] ${issue.path.join('.')}: ${issue.message}`)
      }
    }
  }

  if (problems.length > 0) {
    throw new Error(`Configuración de plugins/pipes inválida:\n${problems.join('\n')}`)
  }
}

/**
 * Mapea los plugins/pipes a la lista de módulos Nest para los `imports` del AppModule.
 * Solo expande — NO valida (eso es trabajo de `assertRegistryConfig`).
 */
export function registryModules(defs: readonly ModuleDef[]): (Type<unknown> | DynamicModule)[] {
  return defs.map((def) => def.module)
}
