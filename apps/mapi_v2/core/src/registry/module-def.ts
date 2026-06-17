import type { DynamicModule, Type } from '@nestjs/common'
import type { ZodType } from 'zod'

/**
 * Categoría de un plugin/pipe montable en el core:
 * - `plugin`: integración de dominio (dueña de sus tablas, rutas, errores).
 * - `pipe`: proceso de fondo sobre BullMQ (worker).
 */
export type ModuleType = 'plugin' | 'pipe'

/**
 * Manifiesto uniforme de un plugin/pipe. Es la ÚNICA forma en que algo se
 * monta en el core (ver README raíz, regla de oro). El core no conoce sus
 * entrañas: solo su `name`, su `type`, el `module` a montar y el Zod de su
 * config para validarla al boot.
 *
 * Cada plugin/pipe exporta una constante `ModuleDef` y la agrega a `REGISTRY`.
 */
export interface ModuleDef {
  /** Id único del plugin/pipe (logs, errores, health). */
  readonly name: string
  /** `plugin` (dominio) o `pipe` (worker BullMQ). */
  readonly type: ModuleType
  /** El NestModule que el core monta en sus `imports`. */
  readonly module: Type<unknown> | DynamicModule
  /**
   * Zod de SUS env vars. El registro lo valida contra `process.env` al boot
   * (fail-fast agregado). Opcional: un plugin/pipe sin config se omite.
   */
  readonly config?: ZodType
}
