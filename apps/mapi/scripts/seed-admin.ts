import 'dotenv/config'
import { drizzle } from 'drizzle-orm/postgres-js'
import { eq } from 'drizzle-orm'
import postgres from 'postgres'
import { hash } from 'bcrypt'
import { randomBytes } from 'node:crypto'
import { users } from '../src/db/schema/users'

/**
 * Seed inicial del admin del sistema.
 *
 * Idempotente: si ya hay un user con role='admin', sale sin hacer nada.
 * Solo se ejecuta exitosamente la PRIMERA vez que el sistema se levanta
 * con la DB recién migrada.
 *
 * Lee `INITIAL_ADMIN_EMAIL` y `INITIAL_ADMIN_FULL_NAME` del .env.
 * Genera password aleatoria de 24 chars (alfanumérica), bcrypt-hash,
 * INSERT.
 *
 * La password se imprime en console.log UNA sola vez. NO se persiste en
 * ningún archivo. Si se pierde antes del primer login, hay que entrar a
 * DB directo y resetear hash, o correr otro script de reset (futuro).
 */

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
  const db = drizzle(client, { schema: { users } })

  try {
    // Idempotente: si ya hay admin, sale sin hacer nada.
    const existing = await db.select().from(users).where(eq(users.role, 'admin')).limit(1)
    if (existing.length > 0) {
      console.log(`[seed] Ya existe admin (${existing[0].email}). No se hace nada.`)
      return
    }

    const password = generatePassword(24)
    const passwordHash = await hash(password, bcryptCost)

    await db.insert(users).values({
      email: adminEmail.toLowerCase(),
      passwordHash,
      fullName: adminFullName,
      role: 'admin',
      status: 'active',
    })

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
