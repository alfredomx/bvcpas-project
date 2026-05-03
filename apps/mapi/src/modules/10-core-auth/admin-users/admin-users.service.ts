import { Inject, Injectable } from '@nestjs/common'
import { eq, count, asc } from 'drizzle-orm'
import { DB, type DrizzleDb } from '../../../core/db/db.module'
import { users, type User } from '../../../db/schema/users'
import { userSessions, type UserSession } from '../../../db/schema/user-sessions'
import { PasswordService } from '../../../core/auth/password.service'
import { SessionsService } from '../../../core/auth/sessions.service'
import { EventLogService } from '../../95-event-log/event-log.service'
import { EmailAlreadyExistsError, UserNotFoundError } from '../errors'
import type { CreateUserDto } from './dto/create-user.dto'
import type { UpdateUserDto } from './dto/update-user.dto'

interface ListResult {
  items: User[]
  total: number
}

interface CreateResult {
  user: User
  initialPassword: string
}

/**
 * Service de gestión admin de usuarios. Solo accesible por role=admin
 * (controlled por @Roles('admin') en el controller).
 */
@Injectable()
export class AdminUsersService {
  constructor(
    @Inject(DB) private readonly db: DrizzleDb,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionsService,
    private readonly events: EventLogService,
  ) {}

  async list(page = 1, pageSize = 50): Promise<ListResult> {
    const offset = (page - 1) * pageSize

    const items = await this.db
      .select()
      .from(users)
      .orderBy(asc(users.createdAt))
      .limit(pageSize)
      .offset(offset)

    const totalRows = await this.db.select({ count: count() }).from(users)
    const total = totalRows[0]?.count ?? 0

    return { items, total }
  }

  async getById(id: string): Promise<User> {
    const rows = await this.db.select().from(users).where(eq(users.id, id)).limit(1)
    const user = rows[0]
    if (!user) {
      throw new UserNotFoundError(`User ${id} no encontrado`)
    }
    return user
  }

  async create(dto: CreateUserDto, actorUserId: string): Promise<CreateResult> {
    const email = dto.email.toLowerCase()
    const password = dto.initialPassword ?? this.passwords.generateRandomPassword(16)

    this.passwords.validateStrength(password)

    // Check duplicado antes de insert (mejor UX que esperar al constraint).
    const existing = await this.db.select().from(users).where(eq(users.email, email)).limit(1)
    if (existing.length > 0) {
      throw new EmailAlreadyExistsError(`Email ${email} ya está registrado`, { email })
    }

    const passwordHash = await this.passwords.hash(password)

    let inserted: User
    try {
      const result = await this.db
        .insert(users)
        .values({
          email,
          passwordHash,
          fullName: dto.fullName,
          role: dto.role,
          status: 'active',
        })
        .returning()
      inserted = result[0]
    } catch (err: unknown) {
      // Race condition: otro insert simultáneo con mismo email ganó.
      const message = err instanceof Error ? err.message : String(err)
      if (message.includes('users_email_unique') || message.toLowerCase().includes('unique')) {
        throw new EmailAlreadyExistsError(`Email ${email} ya está registrado`, { email })
      }
      throw err
    }

    await this.events.log(
      'auth.user.created',
      {
        userId: inserted.id,
        email: inserted.email,
        role: inserted.role,
      },
      actorUserId,
      { type: 'user', id: inserted.id },
    )

    return { user: inserted, initialPassword: password }
  }

  async update(id: string, dto: UpdateUserDto, actorUserId: string): Promise<User> {
    const existing = await this.getById(id)

    const changes: Partial<Pick<User, 'fullName' | 'role' | 'status'>> = {}
    if (dto.fullName !== undefined) changes.fullName = dto.fullName
    if (dto.role !== undefined) changes.role = dto.role
    if (dto.status !== undefined) changes.status = dto.status

    if (Object.keys(changes).length === 0) {
      return existing
    }

    const result = await this.db.update(users).set(changes).where(eq(users.id, id)).returning()
    const updated = result[0]

    // Eventos: además del genérico 'updated', si cambió status disparar
    // 'disabled' o 'enabled' para auditoría granular.
    await this.events.log(
      'auth.user.updated',
      {
        userId: id,
        changes,
      },
      actorUserId,
      { type: 'user', id },
    )

    if (dto.status !== undefined && dto.status !== existing.status) {
      const eventType = dto.status === 'disabled' ? 'auth.user.disabled' : 'auth.user.enabled'
      await this.events.log(eventType, { userId: id }, actorUserId, {
        type: 'user',
        id,
      })
    }

    return updated
  }

  async resetPassword(id: string, actorUserId: string): Promise<{ temporaryPassword: string }> {
    await this.getById(id) // valida que existe

    const password = this.passwords.generateRandomPassword(16)
    const passwordHash = await this.passwords.hash(password)

    await this.db.update(users).set({ passwordHash }).where(eq(users.id, id))

    // Revocar todas las sesiones del user (forzar re-login con nueva pwd).
    await this.sessions.revokeAllForUser(id)

    await this.events.log('auth.user.password_reset', { userId: id }, actorUserId, {
      type: 'user',
      id,
    })

    return { temporaryPassword: password }
  }

  async listSessions(userId: string): Promise<UserSession[]> {
    await this.getById(userId) // valida que existe

    return this.db
      .select()
      .from(userSessions)
      .where(eq(userSessions.userId, userId))
      .orderBy(asc(userSessions.createdAt))
  }

  async revokeAllSessions(userId: string, actorUserId: string): Promise<number> {
    await this.getById(userId)
    const count = await this.sessions.revokeAllForUser(userId)
    await this.events.log(
      'auth.session.revoke_all_by_admin',
      { userId, count, revokedByUserId: actorUserId },
      actorUserId,
      { type: 'user', id: userId },
    )
    return count
  }

  /**
   * Aux: serializa User a UserDto (sin password_hash, fechas como ISO).
   */
  static serialize(user: User): {
    id: string
    email: string
    fullName: string
    role: User['role']
    status: User['status']
    lastLoginAt: string | null
    createdAt: string
    updatedAt: string
  } {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      status: user.status,
      lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    }
  }
}
