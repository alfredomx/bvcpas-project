import { z } from 'zod'

/**
 * Schema de validación de variables de entorno.
 *
 * Solo se validan las variables que el código de Fundación lee. Cada módulo
 * de negocio agrega sus líneas cuando entra (JWT_SECRET, INTUIT_*, etc.).
 *
 * Si una variable requerida falta o tiene tipo inválido, el bootstrap falla
 * con mensaje claro listando todas las violaciones.
 */
/**
 * Helper: convierte "" en undefined para que `.optional()` funcione con
 * vars vacías en `.env` (`PUBLIC_URL=` no debería romper la validación).
 */
const emptyToUndefined = (v: unknown): unknown =>
  typeof v === 'string' && v.length === 0 ? undefined : v

export const configSchema = z.object({
  NODE_ENV: z.enum(['local', 'test', 'production']).default('local'),
  PORT: z.coerce.number().int().positive().default(4000),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  PUBLIC_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
  LOKI_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
  DATABASE_URL: z.string().url(),
})

export type AppConfig = z.infer<typeof configSchema>
