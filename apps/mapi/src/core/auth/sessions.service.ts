import { Inject, Injectable, Logger } from '@nestjs/common'
import { eq, and, isNull, ne, sql, inArray } from 'drizzle-orm'
import ms from 'ms'
import type { StringValue } from 'ms'
import type Redis from 'ioredis'
import { randomUUID } from 'node:crypto'
import { DB, type DrizzleDb } from '../db/db.module'
import { userSessions, type UserSession } from '../../db/schema/user-sessions'
import { users, type UserRole, type UserStatus } from '../../db/schema/users'
import { JwtService } from './jwt.service'
import { AppConfigService } from '../config/config.service'
import { REDIS_CLIENT } from './redis.module'
import {
  SessionExpiredError,
  SessionNotFoundError,
  SessionRevokedError,
  UserDisabledError,
} from '../../modules/10-core-auth/errors'

/**
 * Información mínima cacheada en Redis. Se invalida al revocar.
 * NO incluye `revoked_at` — la verificación de revocación se hace por
 * presencia/ausencia de la entry en cache (DEL al revocar) + verificación
 * en DB cuando hay miss.
 */
interface CachedSession {
  userId: string
  email: string
  role: UserRole
  status: UserStatus
  expiresAt: number // unix timestamp ms
}

/**
 * Resultado de verificar una sesión: contexto del user dueño.
 */
export interface SessionContext {
  userId: string
  email: string
  role: UserRole
  jti: string
}

const CACHE_TTL_SECONDS = 30
const TOUCH_DEBOUNCE_MS = 5 * 60 * 1000 // 5 minutos

/**
 * Servicio que gestiona sesiones de usuario revocables.
 *
 * Combina DB (`user_sessions`) y Redis (cache 30s). Cada login crea row +
 * JWT con `jti`. Cada request autenticado verifica con cache primero;
 * si miss, golpea DB.
 *
 * Trade-off conocido: revocar tarda hasta 30s en propagar si NO se invalida
 * el cache explícitamente. La implementación SÍ invalida cache al revocar
 * (DEL session:<jti>), así que en práctica es inmediato. El TTL solo
 * cubre el caso de fallo de Redis al hacer DEL.
 */
@Injectable()
export class SessionsService {
  private readonly logger = new Logger(SessionsService.name)

  constructor(
    @Inject(DB) private readonly db: DrizzleDb,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly jwt: JwtService,
    private readonly cfg: AppConfigService,
  ) {}

  /**
   * Crea una sesión nueva para un user. Inserta en `user_sessions`,
   * firma JWT con jti, retorna ambos.
   */
  async create(
    user: { id: string; email: string; role: UserRole },
    userAgent?: string,
    ip?: string,
  ): Promise<{ token: string; sessionId: string; jti: string }> {
    const jti = randomUUID()
    const expiresInMs = ms(this.cfg.jwtExpiresIn as StringValue)
    if (typeof expiresInMs !== 'number') {
      throw new Error(`JWT_EXPIRES_IN inválido: ${this.cfg.jwtExpiresIn}`)
    }
    const expiresAt = new Date(Date.now() + expiresInMs)

    const [inserted] = await this.db
      .insert(userSessions)
      .values({
        userId: user.id,
        jti,
        userAgent: userAgent ?? null,
        ip: ip ?? null,
        expiresAt,
      })
      .returning({ id: userSessions.id })

    const token = this.jwt.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
      jti,
    })

    return { token, sessionId: inserted.id, jti }
  }

  /**
   * Verifica que una sesión por jti está activa. Lanza error de dominio
   * apropiado si:
   * - SessionNotFoundError: jti no existe en DB.
   * - SessionRevokedError: revoked_at IS NOT NULL.
   * - SessionExpiredError: expires_at < now().
   * - UserDisabledError: user.status='disabled'.
   *
   * Usa cache Redis (TTL 30s) para evitar query DB en cada request.
   */
  async verify(jti: string): Promise<SessionContext> {
    const cacheKey = this.cacheKey(jti)
    const cached = await this.readCache(cacheKey)

    if (cached) {
      // Verificación de expiry desde el cache (puede haber pasado durante TTL).
      if (cached.expiresAt < Date.now()) {
        await this.redis.del(cacheKey)
        throw new SessionExpiredError({ jti })
      }
      // Si está en cache, NO está revocada (cache se invalida al revocar).
      return {
        userId: cached.userId,
        email: cached.email,
        role: cached.role,
        jti,
      }
    }

    // Cache miss: pegar a DB.
    const rows = await this.db
      .select({
        userId: userSessions.userId,
        revokedAt: userSessions.revokedAt,
        expiresAt: userSessions.expiresAt,
        userEmail: users.email,
        userRole: users.role,
        userStatus: users.status,
      })
      .from(userSessions)
      .innerJoin(users, eq(userSessions.userId, users.id))
      .where(eq(userSessions.jti, jti))
      .limit(1)

    if (rows.length === 0) {
      throw new SessionNotFoundError(`Session ${jti} no existe`, { jti })
    }

    const row = rows[0]

    if (row.revokedAt !== null) {
      throw new SessionRevokedError({ jti })
    }

    const expiresAtMs = row.expiresAt.getTime()
    if (expiresAtMs < Date.now()) {
      throw new SessionExpiredError({ jti })
    }

    if (row.userStatus === 'disabled') {
      throw new UserDisabledError({ userId: row.userId })
    }

    // Escribir cache.
    await this.writeCache(cacheKey, {
      userId: row.userId,
      email: row.userEmail,
      role: row.userRole,
      status: row.userStatus,
      expiresAt: expiresAtMs,
    })

    return {
      userId: row.userId,
      email: row.userEmail,
      role: row.userRole,
      jti,
    }
  }

  /**
   * Revoca una sesión específica por jti. Marca `revoked_at = now()` en
   * DB e invalida cache Redis (DEL).
   *
   * Idempotente: si ya está revocada, no hace nada.
   */
  async revoke(jti: string): Promise<void> {
    await this.db
      .update(userSessions)
      .set({ revokedAt: sql`now()` })
      .where(and(eq(userSessions.jti, jti), isNull(userSessions.revokedAt)))

    await this.redis.del(this.cacheKey(jti)).catch((err: unknown) => {
      this.logger.warn(
        `[sessions] Failed DEL cache para jti=${jti}: ${err instanceof Error ? err.message : String(err)}`,
      )
    })
  }

  /**
   * Revoca TODAS las sesiones activas de un user. Retorna cuántas se
   * revocaron. Invalida cache Redis para cada jti.
   *
   * Si `exceptJti` se proporciona, esa sesión NO se revoca (útil para
   * "cambio de password" donde queremos mantener la sesión activa actual).
   */
  async revokeAllForUser(userId: string, exceptJti?: string): Promise<number> {
    const conditions = [eq(userSessions.userId, userId), isNull(userSessions.revokedAt)]
    if (exceptJti) {
      conditions.push(ne(userSessions.jti, exceptJti))
    }

    // Primero leer los jti afectados para invalidar Redis.
    const affected = await this.db
      .select({ jti: userSessions.jti })
      .from(userSessions)
      .where(and(...conditions))

    if (affected.length === 0) {
      return 0
    }

    await this.db
      .update(userSessions)
      .set({ revokedAt: sql`now()` })
      .where(
        and(
          eq(userSessions.userId, userId),
          isNull(userSessions.revokedAt),
          inArray(
            userSessions.jti,
            affected.map((a) => a.jti),
          ),
        ),
      )

    // Invalidar cache (errores no rompen la operación).
    await Promise.all(
      affected.map((a) =>
        this.redis.del(this.cacheKey(a.jti)).catch((err: unknown) => {
          this.logger.warn(
            `[sessions] Failed DEL cache para jti=${a.jti}: ${err instanceof Error ? err.message : String(err)}`,
          )
        }),
      ),
    )

    return affected.length
  }

  /**
   * Actualiza `last_seen_at` de una sesión con debounce de 5 min.
   * No actualiza si la última actualización fue hace <5 min.
   *
   * Reduce write load en DB para sesiones activas.
   */
  async touchLastSeen(jti: string): Promise<void> {
    const now = new Date()
    const threshold = new Date(now.getTime() - TOUCH_DEBOUNCE_MS)

    await this.db
      .update(userSessions)
      .set({ lastSeenAt: now })
      .where(and(eq(userSessions.jti, jti), sql`${userSessions.lastSeenAt} < ${threshold}`))
  }

  /**
   * Busca una sesión por jti. Retorna null si no existe. Útil para
   * lookup directo (admin viendo sesiones de un user).
   */
  async findByJti(jti: string): Promise<UserSession | null> {
    const rows = await this.db.select().from(userSessions).where(eq(userSessions.jti, jti)).limit(1)
    return rows[0] ?? null
  }

  /**
   * Busca una sesión por id (PK). Retorna null si no existe.
   */
  async findById(sessionId: string): Promise<UserSession | null> {
    const rows = await this.db
      .select()
      .from(userSessions)
      .where(eq(userSessions.id, sessionId))
      .limit(1)
    return rows[0] ?? null
  }

  private cacheKey(jti: string): string {
    return `session:${jti}`
  }

  private async readCache(key: string): Promise<CachedSession | null> {
    try {
      const raw = await this.redis.get(key)
      if (raw === null) return null
      return JSON.parse(raw) as CachedSession
    } catch (err: unknown) {
      this.logger.warn(
        `[sessions] readCache failed: ${err instanceof Error ? err.message : String(err)}`,
      )
      return null
    }
  }

  private async writeCache(key: string, value: CachedSession): Promise<void> {
    try {
      await this.redis.set(key, JSON.stringify(value), 'EX', CACHE_TTL_SECONDS)
    } catch (err: unknown) {
      this.logger.warn(
        `[sessions] writeCache failed: ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }
}
