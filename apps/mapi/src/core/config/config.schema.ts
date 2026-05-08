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

  // 10-core-auth (v0.2.0): JWT + sesiones + cache Redis
  JWT_SECRET: z.string().min(32, 'JWT_SECRET debe tener al menos 32 caracteres'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  // Min 4 acepta BCRYPT_COST=4 en tests (velocidad). En producción setear ≥10.
  BCRYPT_COST: z.coerce.number().int().min(4).max(14).default(12),
  REDIS_URL: z.string().url(),

  // Solo en seed inicial. NO se validan en cada arranque (el seed los lee directo).
  INITIAL_ADMIN_EMAIL: z.preprocess(emptyToUndefined, z.string().email().optional()),
  INITIAL_ADMIN_FULL_NAME: z.preprocess(emptyToUndefined, z.string().min(1).optional()),

  // 20-intuit-oauth (v0.3.0): encryption + OAuth Intuit
  // ENCRYPTION_KEY: 32 bytes base64. Generar con: openssl rand -base64 32
  ENCRYPTION_KEY: z
    .string()
    .regex(
      /^[A-Za-z0-9+/]{43}=$/,
      'ENCRYPTION_KEY debe ser 32 bytes base64 (44 chars con padding =)',
    ),
  INTUIT_CLIENT_ID: z.string().min(1, 'INTUIT_CLIENT_ID requerido'),
  INTUIT_CLIENT_SECRET: z.string().min(1, 'INTUIT_CLIENT_SECRET requerido'),
  INTUIT_REDIRECT_URI: z.string().url('INTUIT_REDIRECT_URI debe ser URL válida'),
  INTUIT_ENVIRONMENT: z.enum(['production']).default('production'),
  INTUIT_MINOR_VERSION: z.coerce.number().int().min(1).default(75),

  // 21-microsoft-oauth (v0.6.2): Microsoft Graph (Outlook por usuario)
  MICROSOFT_CLIENT_ID: z.string().min(1, 'MICROSOFT_CLIENT_ID requerido'),
  MICROSOFT_CLIENT_SECRET: z.string().min(20, 'MICROSOFT_CLIENT_SECRET requerido (≥20 chars)'),
  MICROSOFT_REDIRECT_URI: z.string().url('MICROSOFT_REDIRECT_URI debe ser URL válida'),

  // 21-connections / providers — Dropbox (v0.9.0)
  DROPBOX_CLIENT_ID: z.string().min(1, 'DROPBOX_CLIENT_ID requerido'),
  DROPBOX_CLIENT_SECRET: z.string().min(1, 'DROPBOX_CLIENT_SECRET requerido'),
  DROPBOX_REDIRECT_URI: z.string().url('DROPBOX_REDIRECT_URI debe ser URL válida'),

  // 21-connections / providers — Google (v0.9.0)
  GOOGLE_CLIENT_ID: z.string().min(1, 'GOOGLE_CLIENT_ID requerido'),
  GOOGLE_CLIENT_SECRET: z.string().min(1, 'GOOGLE_CLIENT_SECRET requerido'),
  GOOGLE_REDIRECT_URI: z.string().url('GOOGLE_REDIRECT_URI debe ser URL válida'),

  // 21-connections / providers — Square (v0.12.0)
  SQUARE_CLIENT_ID: z.string().min(1, 'SQUARE_CLIENT_ID requerido'),
  SQUARE_CLIENT_SECRET: z.string().min(1, 'SQUARE_CLIENT_SECRET requerido'),
  SQUARE_REDIRECT_URI: z.string().url('SQUARE_REDIRECT_URI debe ser URL válida'),
})

export type AppConfig = z.infer<typeof configSchema>
