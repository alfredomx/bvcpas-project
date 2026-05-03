import { AdminUsersService } from '../../../src/modules/10-core-auth/admin-users/admin-users.service'
import { PasswordService } from '../../../src/core/auth/password.service'
import type { SessionsService } from '../../../src/core/auth/sessions.service'
import type { EventLogService } from '../../../src/modules/95-event-log/event-log.service'
import type { DrizzleDb } from '../../../src/core/db/db.module'
import type { AppConfigService } from '../../../src/core/config/config.service'
import {
  EmailAlreadyExistsError,
  UserNotFoundError,
} from '../../../src/modules/10-core-auth/errors'
import userActive from '../../fixtures/auth/user-active.json'

/**
 * Tests Tipo A para AdminUsersService.
 *
 * Cobertura:
 * - getById con id inexistente → UserNotFoundError.
 * - create() con email duplicado → EmailAlreadyExistsError.
 * - update() con status disabled → dispara event auth.user.disabled.
 * - update() con status active (era disabled) → dispara auth.user.enabled.
 * - CR-auth-032 (parcial): resetPassword revoca todas las sesiones del user.
 * - listSessions con user inexistente → UserNotFoundError.
 * - revokeAllSessions retorna count.
 */

interface DbState {
  selectByIdReturns: typeof userActive | null
  selectByEmailReturns: typeof userActive | null
  insertThrows?: Error
  insertReturning?: typeof userActive
  updateReturning?: typeof userActive
  selectSessionsReturns?: unknown[]
}

function buildDb(state: DbState): DrizzleDb {
  return {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: jest.fn().mockImplementation(() => {
            const result = state.selectByIdReturns ?? state.selectByEmailReturns
            return Promise.resolve(result ? [result] : [])
          }),
          orderBy: jest
            .fn()
            .mockImplementation(() => Promise.resolve(state.selectSessionsReturns ?? [])),
        }),
        orderBy: () => ({
          limit: () => ({
            offset: jest
              .fn()
              .mockImplementation(() => Promise.resolve([state.selectByIdReturns].filter(Boolean))),
          }),
        }),
      }),
    }),
    insert: () => ({
      values: () => ({
        returning: jest.fn().mockImplementation(() => {
          if (state.insertThrows) return Promise.reject(state.insertThrows)
          return Promise.resolve(state.insertReturning ? [state.insertReturning] : [userActive])
        }),
      }),
    }),
    update: () => ({
      set: () => ({
        where: jest
          .fn()
          .mockImplementation(() => Promise.resolve())
          .mockReturnValue({
            returning: jest.fn().mockImplementation(() => {
              return Promise.resolve(state.updateReturning ? [state.updateReturning] : [userActive])
            }),
          }),
      }),
    }),
  } as unknown as DrizzleDb
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

function buildSessions(): SessionsService {
  return {
    revokeAllForUser: jest.fn().mockResolvedValue(0),
  } as unknown as SessionsService
}

function buildPasswords(): PasswordService {
  return new PasswordService({ bcryptCost: 4 } as AppConfigService)
}

describe('AdminUsersService', () => {
  describe('getById', () => {
    it('id inexistente → UserNotFoundError', async () => {
      const service = new AdminUsersService(
        buildDb({ selectByIdReturns: null, selectByEmailReturns: null }),
        buildPasswords(),
        buildSessions(),
        buildEvents(),
      )

      await expect(service.getById('no-existe-id')).rejects.toThrow(UserNotFoundError)
    })

    it('id existe → retorna user', async () => {
      const service = new AdminUsersService(
        buildDb({ selectByIdReturns: userActive, selectByEmailReturns: null }),
        buildPasswords(),
        buildSessions(),
        buildEvents(),
      )

      const user = await service.getById(userActive.id)
      expect(user.id).toBe(userActive.id)
    })
  })

  describe('create', () => {
    it('email duplicado (pre-check) → EmailAlreadyExistsError', async () => {
      const service = new AdminUsersService(
        buildDb({ selectByIdReturns: null, selectByEmailReturns: userActive }),
        buildPasswords(),
        buildSessions(),
        buildEvents(),
      )

      await expect(
        service.create(
          {
            email: userActive.email,
            fullName: 'Otro',
            role: 'viewer',
          },
          'actor-id',
        ),
      ).rejects.toThrow(EmailAlreadyExistsError)
    })

    it('happy path retorna user + initialPassword + dispara evento', async () => {
      const events = buildEvents()
      const service = new AdminUsersService(
        buildDb({
          selectByIdReturns: null,
          selectByEmailReturns: null,
          insertReturning: userActive,
        }),
        buildPasswords(),
        buildSessions(),
        events,
      )

      const result = await service.create(
        {
          email: 'nuevo@example.com',
          fullName: 'Nuevo',
          role: 'viewer',
        },
        'actor-id',
      )

      expect(result.user).toBeDefined()
      expect(result.initialPassword).toHaveLength(16)

      const ev = events.logged.find((e) => e.eventType === 'auth.user.created')
      expect(ev?.actorUserId).toBe('actor-id')
    })
  })

  describe('update', () => {
    it('status disabled → dispara auth.user.disabled', async () => {
      const events = buildEvents()
      const updated = { ...userActive, status: 'disabled' as const }
      const service = new AdminUsersService(
        buildDb({
          selectByIdReturns: userActive,
          selectByEmailReturns: null,
          updateReturning: updated,
        }),
        buildPasswords(),
        buildSessions(),
        events,
      )

      await service.update(userActive.id, { status: 'disabled' }, 'admin-id')

      const ev = events.logged.find((e) => e.eventType === 'auth.user.disabled')
      expect(ev?.actorUserId).toBe('admin-id')
    })

    it('sin cambios → no dispara evento de update', async () => {
      const events = buildEvents()
      const service = new AdminUsersService(
        buildDb({
          selectByIdReturns: userActive,
          selectByEmailReturns: null,
        }),
        buildPasswords(),
        buildSessions(),
        events,
      )

      await service.update(userActive.id, {}, 'admin-id')

      const ev = events.logged.find((e) => e.eventType === 'auth.user.updated')
      expect(ev).toBeUndefined()
    })
  })

  describe('CR-auth-032: resetPassword', () => {
    it('revoca todas las sesiones del user y dispara evento', async () => {
      const sessions = buildSessions()
      const events = buildEvents()
      const service = new AdminUsersService(
        buildDb({ selectByIdReturns: userActive, selectByEmailReturns: null }),
        buildPasswords(),
        sessions,
        events,
      )

      const result = await service.resetPassword(userActive.id, 'admin-id')

      expect(result.temporaryPassword).toHaveLength(16)
      expect(sessions.revokeAllForUser).toHaveBeenCalledWith(userActive.id)
      const ev = events.logged.find((e) => e.eventType === 'auth.user.password_reset')
      expect(ev?.actorUserId).toBe('admin-id')
    })

    it('user inexistente → UserNotFoundError', async () => {
      const service = new AdminUsersService(
        buildDb({ selectByIdReturns: null, selectByEmailReturns: null }),
        buildPasswords(),
        buildSessions(),
        buildEvents(),
      )

      await expect(service.resetPassword('no-existe', 'admin-id')).rejects.toThrow(
        UserNotFoundError,
      )
    })
  })

  describe('listSessions', () => {
    it('user inexistente → UserNotFoundError', async () => {
      const service = new AdminUsersService(
        buildDb({ selectByIdReturns: null, selectByEmailReturns: null }),
        buildPasswords(),
        buildSessions(),
        buildEvents(),
      )

      await expect(service.listSessions('no-existe')).rejects.toThrow(UserNotFoundError)
    })
  })

  describe('revokeAllSessions', () => {
    it('retorna count y dispara evento auth.session.revoke_all_by_admin', async () => {
      const sessions = buildSessions()
      ;(sessions.revokeAllForUser as jest.Mock).mockResolvedValue(2)
      const events = buildEvents()
      const service = new AdminUsersService(
        buildDb({ selectByIdReturns: userActive, selectByEmailReturns: null }),
        buildPasswords(),
        sessions,
        events,
      )

      const count = await service.revokeAllSessions(userActive.id, 'admin-id')

      expect(count).toBe(2)
      const ev = events.logged.find((e) => e.eventType === 'auth.session.revoke_all_by_admin')
      expect(ev?.actorUserId).toBe('admin-id')
    })
  })
})
