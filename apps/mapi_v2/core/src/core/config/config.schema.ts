import { z } from 'zod'

/**
 * Schema de validación de variables de entorno del CORE.
 *
 * Solo se validan las vars que el core ya lee. Cada pieza de infra agrega
 * sus líneas cuando entra (REDIS_URL con queue, JWT_SECRET con jwt-verify,
 * INTUIT_* con qbo-client, etc.). Core flaco: no metemos vars que nada usa.
 *
 * Si una var requerida falta o tiene tipo inválido, el bootstrap falla con
 * mensaje claro listando todas las violaciones.
 */
/** Helper: convierte "" en undefined para que `.optional()` funcione con vars vacías. */
const emptyToUndefined = (v: unknown): unknown =>
  typeof v === 'string' && v.length === 0 ? undefined : v

export const configSchema = z.object({
  NODE_ENV: z.enum(['local', 'test', 'production']).default('local'),
  PORT: z.coerce.number().int().positive().default(4200),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  PUBLIC_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
})

export type AppConfig = z.infer<typeof configSchema>
