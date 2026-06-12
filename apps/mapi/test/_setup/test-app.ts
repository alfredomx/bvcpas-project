import { Test } from '@nestjs/testing'
import type { INestApplication } from '@nestjs/common'
import { ValidationPipe } from '@nestjs/common'
import { config as dotenvConfig } from 'dotenv'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { sql } from 'drizzle-orm'
import { AppModule } from '../../src/app.module'

/**
 * Helper para tests E2E (Tipo B): levanta una INestApplication apuntando
 * a `mapi_test` (DB de tests).
 *
 * Cada test debe llamar `setupTestApp()` en `beforeAll` y `app.close()`
 * en `afterAll`. Para limpiar tablas entre tests, usar `truncateTables()`.
 *
 * Carga `.env.test` antes de bootstrap.
 */

let envLoaded = false

function ensureEnvLoaded(): void {
  if (envLoaded) return
  dotenvConfig({ path: '.env.test' })
  envLoaded = true
}

export async function setupTestApp(): Promise<INestApplication> {
  ensureEnvLoaded()

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile()

  const app = moduleRef.createNestApplication()
  app.setGlobalPrefix('v1', { exclude: ['metrics'] })
  // Sin pipes de validación adicionales — los DTOs Zod ya validan en el
  // controller. Si necesitas pipe custom para algún test, agregar aquí.
  void ValidationPipe

  await app.init()
  return app
}

/**
 * Limpia todas las tablas (DELETE rows) sin re-correr migrations.
 * Útil entre tests dentro de un mismo describe para estado fresco.
 */
export async function truncateTables(): Promise<void> {
  ensureEnvLoaded()
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error('DATABASE_URL requerido')
  const client = postgres(databaseUrl, { max: 1 })
  const db = drizzle(client)
  try {
    // NOTA v0.15.0: NO truncar `roles`, `permissions`, `role_permissions` —
    // los roles del sistema (Administrator, Viewer) y los 27 permisos del
    // catálogo son seedeados por la migration 0018 y deben sobrevivir entre
    // tests. Solo se limpian las ASIGNACIONES (user_roles, user_permissions).
    //
    // IMPORTANTE: `users` NO va en TRUNCATE CASCADE porque las tablas
    // RBAC (`role_permissions`, `user_roles`, `user_permissions`) tienen FK
    // `granted_by` → `users.id` (ON DELETE SET NULL), y TRUNCATE CASCADE
    // ignora la regla — directamente cascadea la limpieza a esas tablas,
    // borrando los 33 role_permissions seedeados.
    //
    // Solución: borrar `users` con DELETE explícito (respeta ON DELETE
    // SET NULL para `granted_by`). Las filas en `user_roles` y
    // `user_permissions` desaparecen por ON DELETE CASCADE de su FK
    // `user_id`. `role_permissions.granted_by` queda en NULL.
    await db.execute(
      sql`TRUNCATE TABLE client_call_logs, client_public_links, client_period_followups, client_transaction_responses, client_transactions, intuit_tokens_deprecated, user_client_access, user_connections, clients, user_sessions, event_log RESTART IDENTITY CASCADE`,
    )
    await db.execute(sql`DELETE FROM users`)
  } finally {
    await client.end()
  }
}
