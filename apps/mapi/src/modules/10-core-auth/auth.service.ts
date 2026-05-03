import { Inject, Injectable } from '@nestjs/common'
import { eq, sql } from 'drizzle-orm'
import { DB, type DrizzleDb } from '../../core/db/db.module'
import { users, type User, type UserRole, type UserStatus } from '../../db/schema/users'
import { PasswordService } from '../../core/auth/password.service'
import { SessionsService } from '../../core/auth/sessions.service'
import { EventLogService } from '../95-event-log/event-log.service'
import {
  InvalidCredentialsError,
  UserDisabledError,
  UserNotFoundError,
  WrongOldPasswordError,
} from './errors'

export interface LoginResult {
  accessToken: string
  user: {
    id: string
    email: string
    fullName: string
    role: UserRole
    status: UserStatus
  }
}

/**
 * Service del módulo `auth` — orquesta login, logout, me, change password.
 *
 * Cada operación dispara evento `event_log` correspondiente.
 */
@Injectable()
export class AuthService {
  constructor(
    @Inject(DB) private readonly db: DrizzleDb,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionsService,
    private readonly events: EventLogService,
  ) {}

  /**
   * Login con email + password. Crea sesión, retorna JWT.
   *
   * Errores:
   * - InvalidCredentialsError: email no existe o password no matchea (mismo
   *   error para no revelar si el email existe).
   * - UserDisabledError: user existe y password OK pero status=disabled.
   */
  async login(
    email: string,
    password: string,
    userAgent?: string,
    ip?: string,
  ): Promise<LoginResult> {
    const normalized = email.toLowerCase()
    const rows = await this.db.select().from(users).where(eq(users.email, normalized)).limit(1)

    const user = rows[0]
    if (!user) {
      await this.events.log('auth.login.failed', {
        email: normalized,
        reason: 'user_not_found',
        ip: ip ?? null,
      })
      throw new InvalidCredentialsError()
    }

    const passwordOk = await this.passwords.compare(password, user.passwordHash)
    if (!passwordOk) {
      await this.events.log('auth.login.failed', {
        email: normalized,
        reason: 'wrong_password',
        ip: ip ?? null,
      })
      throw new InvalidCredentialsError()
    }

    if (user.status === 'disabled') {
      await this.events.log(
        'auth.login.failed',
        {
          email: normalized,
          reason: 'user_disabled',
          ip: ip ?? null,
        },
        user.id,
      )
      throw new UserDisabledError({ userId: user.id })
    }

    const session = await this.sessions.create(
      { id: user.id, email: user.email, role: user.role },
      userAgent,
      ip,
    )

    await this.db
      .update(users)
      .set({ lastLoginAt: sql`now()` })
      .where(eq(users.id, user.id))

    await this.events.log(
      'auth.login.success',
      {
        ip: ip ?? null,
        userAgent: userAgent ?? null,
        sessionId: session.sessionId,
      },
      user.id,
    )

    return {
      accessToken: session.token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        status: user.status,
      },
    }
  }

  /**
   * Logout de la sesión actual: revoca el jti del JWT que mandó la request.
   */
  async logout(jti: string, userId: string): Promise<void> {
    await this.sessions.revoke(jti)
    await this.events.log('auth.logout', { jti }, userId)
  }

  /**
   * Logout de TODAS las sesiones del user. Útil si pierde laptop.
   * Retorna count de sesiones revocadas.
   */
  async logoutAll(userId: string): Promise<number> {
    const count = await this.sessions.revokeAllForUser(userId)
    await this.events.log('auth.logout_all', { sessionsRevokedCount: count }, userId)
    return count
  }

  /**
   * Datos del user autenticado.
   */
  async me(userId: string): Promise<User> {
    const rows = await this.db.select().from(users).where(eq(users.id, userId)).limit(1)
    const user = rows[0]
    if (!user) {
      throw new UserNotFoundError(`User ${userId} no encontrado`)
    }
    return user
  }

  /**
   * Cambia la password del user. Revoca todas las otras sesiones (excepto
   * la actual). Si oldPassword no matchea → WrongOldPasswordError.
   */
  async changePassword(
    userId: string,
    oldPassword: string,
    newPassword: string,
    currentJti: string,
  ): Promise<void> {
    const rows = await this.db.select().from(users).where(eq(users.id, userId)).limit(1)
    const user = rows[0]
    if (!user) {
      throw new UserNotFoundError(`User ${userId} no encontrado`)
    }

    const oldOk = await this.passwords.compare(oldPassword, user.passwordHash)
    if (!oldOk) {
      throw new WrongOldPasswordError()
    }

    this.passwords.validateStrength(newPassword)
    const newHash = await this.passwords.hash(newPassword)

    await this.db.update(users).set({ passwordHash: newHash }).where(eq(users.id, userId))

    // Revoca todas las otras sesiones del user (excepto la actual).
    await this.sessions.revokeAllForUser(userId, currentJti)

    await this.events.log('auth.user.password_changed', {}, userId)
  }
}
