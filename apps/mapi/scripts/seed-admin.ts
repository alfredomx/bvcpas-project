import 'dotenv/config'
import { drizzle } from 'drizzle-orm/postgres-js'
import { and, eq } from 'drizzle-orm'
import postgres from 'postgres'
import { hash } from 'bcrypt'
import { randomBytes } from 'node:crypto'
import { users } from '../src/db/schema/users'
import { userRoles } from '../src/db/schema/user-roles'

/**
 * Seed inicial del admin del sistema.
 *
 * Idempotente: si ya existe un user con el email `INITIAL_ADMIN_EMAIL`
 * y ese user ya tiene el rol `Administrator`, sale sin hacer nada.
 *
 * Solo se ejecuta exitosamente la PRIMERA vez que el sistema se levanta
 * con la DB recién migrada.
 *
 * Lee `INITIAL_ADMIN_EMAIL` y `INITIAL_ADMIN_FULL_NAME` del .env.
 * Genera password aleatoria de 24 chars (alfanumérica), bcrypt-hash,
 * INSERT en `users` + INSERT en `user_roles` con el rol `Administrator`
 * (UUID hardcoded del sistema seedeado por la migration 0018).
 *
 * v0.15.0: la columna `users.role` fue eliminada. La asignación de rol
 * ahora vive en `user_roles` (RBAC dinámico).
 *
 * La password se imprime en console.log UNA sola vez. NO se persiste en
 * ningún archivo. Si se pierde antes del primer login, hay que entrar a
 * DB directo y resetear hash, o correr otro script de reset (futuro).
 */

/**
 * UUID del rol `Administrator` del sistema (seedeado por la migration
 * 0018_uneven_puppet_master.sql). Coincide con `SYSTEM_ROLE_IDS.ADMINISTRATOR`
 * en `src/core/permissions/permissions.repository.ts`.
 */
const ADMINISTRATOR_ROLE_ID = '00000000-0000-0000-0000-000000000001'

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'

function generatePassword(length: number): string {
  const buffer = randomBytes(length)
  let result = ''
  for (let i = 0; i < length; i++) {
    result += ALPHABET[buffer[i] % ALPHABET.length]
  }
  return result
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL
  const adminEmail = process.env.INITIAL_ADMIN_EMAIL
  const adminFullName = process.env.INITIAL_ADMIN_FULL_NAME
  const bcryptCost = Number(process.env.BCRYPT_COST ?? 12)

  if (!databaseUrl) {
    throw new Error('DATABASE_URL es requerido')
  }
  if (!adminEmail || !adminFullName) {
    throw new Error('INITIAL_ADMIN_EMAIL y INITIAL_ADMIN_FULL_NAME son requeridos')
  }

  const client = postgres(databaseUrl, { max: 1 })
  const db = drizzle(client, { schema: { users, userRoles } })

  try {
    const normalizedEmail = adminEmail.toLowerCase()

    // Idempotente: si ya hay un user con ese email Y tiene el rol
    // Administrator asignado, sale sin hacer nada.
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1)

    if (existingUser.length > 0) {
      const hasAdminRole = await db
        .select()
        .from(userRoles)
        .where(
          and(
            eq(userRoles.userId, existingUser[0].id),
            eq(userRoles.roleId, ADMINISTRATOR_ROLE_ID),
          ),
        )
        .limit(1)
      if (hasAdminRole.length > 0) {
        console.log(`[seed] Ya existe admin (${existingUser[0].email}). No se hace nada.`)
        return
      }
      // User existe pero no tiene rol Administrator — lo asignamos.
      await db
        .insert(userRoles)
        .values({ userId: existingUser[0].id, roleId: ADMINISTRATOR_ROLE_ID })
      console.log(`[seed] Rol Administrator asignado a user existente ${existingUser[0].email}.`)
      return
    }

    const password = generatePassword(24)
    const passwordHash = await hash(password, bcryptCost)

    const [inserted] = await db
      .insert(users)
      .values({
        email: normalizedEmail,
        passwordHash,
        fullName: adminFullName,
        status: 'active',
      })
      .returning({ id: users.id })

    // Asignar rol Administrator del sistema.
    await db.insert(userRoles).values({ userId: inserted.id, roleId: ADMINISTRATOR_ROLE_ID })

    console.log('═'.repeat(72))
    console.log('[seed] Admin creado:')
    console.log(`  Email:    ${adminEmail.toLowerCase()}`)
    console.log(`  Password: ${password}`)
    console.log('═'.repeat(72))
    console.log('CAMBIARLA AL PRIMER LOGIN. NO se va a mostrar de nuevo.')
    console.log('═'.repeat(72))
  } finally {
    await client.end()
  }
}

main().catch((err: unknown) => {
  console.error('[seed] failed:', err instanceof Error ? err.message : err)
  process.exit(1)
})
