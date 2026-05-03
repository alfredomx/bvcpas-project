import { AuthService } from '../../../src/modules/auth/auth.service'
import { PasswordService } from '../../../src/core/auth/password.service'
import type { SessionsService } from '../../../src/core/auth/sessions.service'
import type { EventLogService } from '../../../src/modules/event-log/event-log.service'
import type { DrizzleDb } from '../../../src/core/db/db.module'
import type { AppConfigService } from '../../../src/core/config/config.service'
import {
  InvalidCredentialsError,
  UserDisabledError,
  WrongOldPasswordError,
} from '../../../src/modules/auth/errors'
import userActive from '../../fixtures/auth/user-active.json'
import userDisabled from '../../fixtures/auth/user-disabled.json'

/**
 * Tests Tipo A para AuthService.
 *
 * Cobertura:
 * - CR-auth-001: login con email no existente → InvalidCredentialsError.
 * - CR-auth-002: login con password incorrecto → InvalidCredentialsError.
 * - CR-auth-003: login con user disabled → UserDisabledError.
 * - CR-auth-005: login OK actualiza last_login_at.
 * - CR-auth-006: login OK dispara auth.login.success con actor_user_id.
 * - CR-auth-007: login fallido dispara auth.login.failed sin actor_user_id.
 * - CR-auth-030: changePassword con old incorrecto → WrongOldPasswordError.
 * - CR-auth-031: changePassword OK revoca otras sesiones (no la actual).
 */

const FIXTURE_PASSWORD_PLAIN = 'correct-password'

interface DbState {
  selectByEmailReturns: typeof userActive | typeof userDisabled | null
  selectByIdReturns: typeof userActive | typeof userDisabled | null
  updateRows: Record<string, unknown>[]
}

function buildDb(state: DbState): DrizzleDb {
  return {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: jest.fn().mockImplementation(() => {
            const result = state.selectByEmailReturns ?? state.selectByIdReturns
            return Promise.resolve(result ? [result] : [])
          }),
        }),
      }),
    }),
    update: () => ({
      set: (values: Record<string, unknown>) => ({
        where: jest.fn().mockImplementation(() => {
          state.updateRows.push(values)
          return Promise.resolve()
        }),
      }),
    }),
  } as unknown as DrizzleDb
}

function buildSessions(): SessionsService {
  return {
    create: jest.fn().mockResolvedValue({
      token: 'mock-jwt-token',
      sessionId: 'session-id-1',
      jti: 'jti-1',
    }),
    revokeAllForUser: jest.fn().mockResolvedValue(0),
    revoke: jest.fn().mockResolvedValue(undefined),
  } as unknown as SessionsService
}

interface EventsMock extends EventLogService {
  logged: { eventType: string; actorUserId?: string }[]
}

function buildEvents(): EventsMock {
  const logged: { eventType: string; actorUserId?: string }[] = []
  const events = {
    log: jest
      .fn()
      .mockImplementation(
        async (
          eventType: string,
          _payload: Record<string, unknown>,
          actorUserId?: string,
        ): Promise<void> => {
          logged.push({ eventType, actorUserId })
          return Promise.resolve()
        },
      ),
    logged,
  }
  return events as unknown as EventsMock
}

function buildPasswords(): PasswordService {
  return new PasswordService({ bcryptCost: 4 } as AppConfigService)
}

async function setupFixtureHash(): Promise<void> {
  const passwords = buildPasswords()
  const hash = await passwords.hash(FIXTURE_PASSWORD_PLAIN)
  userActive.passwordHash = hash
  userDisabled.passwordHash = hash
}

describe('AuthService', () => {
  beforeAll(async () => {
    await setupFixtureHash()
  })

  describe('login', () => {
    it('CR-auth-001: email no existe → InvalidCredentialsError', async () => {
      const events = buildEvents()
      const db = buildDb({
        selectByEmailReturns: null,
        selectByIdReturns: null,
        updateRows: [],
      })
      const service = new AuthService(db, buildPasswords(), buildSessions(), events)

      await expect(service.login('noexiste@x.com', 'pass')).rejects.toThrow(InvalidCredentialsError)

      expect(events.logged).toContainEqual({
        eventType: 'auth.login.failed',
        actorUserId: undefined,
      })
    })

    it('CR-auth-002: password incorrecto → InvalidCredentialsError', async () => {
      const events = buildEvents()
      const db = buildDb({
        selectByEmailReturns: userActive,
        selectByIdReturns: null,
        updateRows: [],
      })
      const service = new AuthService(db, buildPasswords(), buildSessions(), events)

      await expect(service.login(userActive.email, 'wrong-password')).rejects.toThrow(
        InvalidCredentialsError,
      )
    })

    it('CR-auth-007: login fallido dispara auth.login.failed SIN actor_user_id', async () => {
      const events = buildEvents()
      const db = buildDb({
        selectByEmailReturns: null,
        selectByIdReturns: null,
        updateRows: [],
      })
      const service = new AuthService(db, buildPasswords(), buildSessions(), events)

      await expect(service.login('noexiste@x.com', 'pass')).rejects.toThrow()
      const failed = events.logged.find((e) => e.eventType === 'auth.login.failed')
      expect(failed).toBeDefined()
      expect(failed?.actorUserId).toBeUndefined()
    })

    it('CR-auth-003: user disabled → UserDisabledError', async () => {
      const events = buildEvents()
      const db = buildDb({
        selectByEmailReturns: userDisabled,
        selectByIdReturns: null,
        updateRows: [],
      })
      const service = new AuthService(db, buildPasswords(), buildSessions(), events)

      await expect(service.login(userDisabled.email, FIXTURE_PASSWORD_PLAIN)).rejects.toThrow(
        UserDisabledError,
      )

      const failed = events.logged.find((e) => e.eventType === 'auth.login.failed')
      expect(failed?.actorUserId).toBe(userDisabled.id)
    })

    it('happy path retorna accessToken y user', async () => {
      const db = buildDb({
        selectByEmailReturns: userActive,
        selectByIdReturns: null,
        updateRows: [],
      })
      const service = new AuthService(db, buildPasswords(), buildSessions(), buildEvents())

      const result = await service.login(userActive.email, FIXTURE_PASSWORD_PLAIN)
      expect(result.accessToken).toBe('mock-jwt-token')
      expect(result.user.id).toBe(userActive.id)
      expect(result.user.email).toBe(userActive.email)
    })

    it('CR-auth-005: login OK actualiza last_login_at', async () => {
      const updateRows: Record<string, unknown>[] = []
      const db = buildDb({
        selectByEmailReturns: userActive,
        selectByIdReturns: null,
        updateRows,
      })
      const service = new AuthService(db, buildPasswords(), buildSessions(), buildEvents())

      await service.login(userActive.email, FIXTURE_PASSWORD_PLAIN)

      const lastLoginUpdate = updateRows.find((row) => 'lastLoginAt' in row)
      expect(lastLoginUpdate).toBeDefined()
    })

    it('CR-auth-006: login OK dispara auth.login.success con actor_user_id', async () => {
      const events = buildEvents()
      const db = buildDb({
        selectByEmailReturns: userActive,
        selectByIdReturns: null,
        updateRows: [],
      })
      const service = new AuthService(db, buildPasswords(), buildSessions(), events)

      await service.login(userActive.email, FIXTURE_PASSWORD_PLAIN)
      const success = events.logged.find((e) => e.eventType === 'auth.login.success')
      expect(success).toBeDefined()
      expect(success?.actorUserId).toBe(userActive.id)
    })
  })

  describe('changePassword', () => {
    it('CR-auth-030: old incorrecto → WrongOldPasswordError', async () => {
      const db = buildDb({
        selectByEmailReturns: null,
        selectByIdReturns: userActive,
        updateRows: [],
      })
      const service = new AuthService(db, buildPasswords(), buildSessions(), buildEvents())

      await expect(
        service.changePassword(userActive.id, 'wrong-old', 'new-password-12345', 'jti'),
      ).rejects.toThrow(WrongOldPasswordError)
    })

    it('CR-auth-031: changePassword OK revoca otras sesiones (excepto actual)', async () => {
      const sessions = buildSessions()
      const db = buildDb({
        selectByEmailReturns: null,
        selectByIdReturns: userActive,
        updateRows: [],
      })
      const service = new AuthService(db, buildPasswords(), sessions, buildEvents())

      await service.changePassword(
        userActive.id,
        FIXTURE_PASSWORD_PLAIN,
        'new-strong-password-123',
        'current-jti',
      )

      expect(sessions.revokeAllForUser).toHaveBeenCalledWith(userActive.id, 'current-jti')
    })
  })

  describe('logout', () => {
    it('revoca la sesión por jti y dispara auth.logout', async () => {
      const sessions = buildSessions()
      const events = buildEvents()
      const db = buildDb({
        selectByEmailReturns: null,
        selectByIdReturns: null,
        updateRows: [],
      })
      const service = new AuthService(db, buildPasswords(), sessions, events)

      await service.logout('jti-abc', userActive.id)

      expect(sessions.revoke).toHaveBeenCalledWith('jti-abc')
      const ev = events.logged.find((e) => e.eventType === 'auth.logout')
      expect(ev?.actorUserId).toBe(userActive.id)
    })
  })

  describe('logoutAll', () => {
    it('revoca todas las sesiones del user y retorna count', async () => {
      const sessions = buildSessions()
      ;(sessions.revokeAllForUser as jest.Mock).mockResolvedValue(3)
      const events = buildEvents()
      const db = buildDb({
        selectByEmailReturns: null,
        selectByIdReturns: null,
        updateRows: [],
      })
      const service = new AuthService(db, buildPasswords(), sessions, events)

      const count = await service.logoutAll(userActive.id)

      expect(count).toBe(3)
      expect(sessions.revokeAllForUser).toHaveBeenCalledWith(userActive.id)
    })
  })
})
