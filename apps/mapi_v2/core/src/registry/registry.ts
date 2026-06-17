import type { DynamicModule, Type } from '@nestjs/common'
import type { ModuleDef } from './module-def'

/**
 * Lista explícita de units montadas en el core. **Vacía por ahora**: el core
 * arranca solo, sin plugins ni pipes.
 *
 * Cada plugin/pipe se da de alta agregando su `ModuleDef` aquí (una línea,
 * seguible con ctrl-click). El core NUNCA importa una unit por nombre fuera de
 * esta lista (regla de oro — ver README raíz). Auto-discovery (escanear
 * `plugins/*`) está diferido al 2º plugin.
 */
export const REGISTRY: ModuleDef[] = []

/**
 * Valida al boot la config (Zod) de cada unit contra el env. Junta TODAS las
 * violaciones de TODAS las units y lanza un solo `Error` claro (fail-fast):
 * así un deploy con varias vars faltantes las muestra todas de una, no de a
 * una. Las units sin `config` se omiten.
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
    throw new Error(`Configuración de units inválida:\n${problems.join('\n')}`)
  }
}

/**
 * Mapea las units a la lista de módulos Nest para los `imports` del AppModule.
 * Solo expande — NO valida (eso es trabajo de `assertRegistryConfig`).
 */
export function registryModules(defs: readonly ModuleDef[]): (Type<unknown> | DynamicModule)[] {
  return defs.map((def) => def.module)
}
