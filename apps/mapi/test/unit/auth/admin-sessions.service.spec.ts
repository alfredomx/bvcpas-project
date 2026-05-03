import { AdminSessionsService } from '../../../src/modules/10-core-auth/admin-sessions/admin-sessions.service'
import type { SessionsService } from '../../../src/core/auth/sessions.service'
import type { EventLogService } from '../../../src/modules/95-event-log/event-log.service'
import type { DrizzleDb } from '../../../src/core/db/db.module'
import { SessionNotFoundError } from '../../../src/modules/10-core-auth/errors'

/**
 * Tests Tipo A para AdminSessionsService.
 *
 * Cobertura:
 * - CR-auth-041: revoke dispara auth.session.revoked_by_admin con
 *   revoked_by_user_id = id del admin.
 * - revoke con sessionId inexistente → SessionNotFoundError.
 */

interface MockSession {
  id: string
  jti: string
  userId: string
}

function buildDb(session: MockSession | null): DrizzleDb {
  return {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: jest.fn().mockResolvedValue(session ? [session] : []),
        }),
      }),
    }),
  } as unknown as DrizzleDb
}

interface EventsMock extends EventLogService {
  logged: { eventType: string; actorUserId?: string; payload: Record<string, unknown> }[]
}

function buildEvents(): EventsMock {
  const logged: { eventType: string; actorUserId?: string; payload: Record<string, unknown> }[] = []
  const events = {
    log: jest
      .fn()
      .mockImplementation(
        async (
          eventType: string,
          payload: Record<string, unknown>,
          actorUserId?: string,
        ): Promise<void> => {
          logged.push({ eventType, actorUserId, payload })
          return Promise.resolve()
        },
      ),
    logged,
  }
  return events as unknown as EventsMock
}

function buildSessions(): SessionsService {
  return {
    revoke: jest.fn().mockResolvedValue(undefined),
  } as unknown as SessionsService
}

describe('AdminSessionsService', () => {
  describe('revoke', () => {
    it('sessionId inexistente → SessionNotFoundError', async () => {
      const service = new AdminSessionsService(buildDb(null), buildSessions(), buildEvents())

      await expect(service.revoke('no-existe', 'admin-id')).rejects.toThrow(SessionNotFoundError)
    })

    it('CR-auth-041: revoke OK dispara auth.session.revoked_by_admin', async () => {
      const session: MockSession = {
        id: 'session-id-1',
        jti: 'jti-target',
        userId: 'user-victim',
      }
      const sessionsSvc = buildSessions()
      const events = buildEvents()
      const service = new AdminSessionsService(buildDb(session), sessionsSvc, events)

      await service.revoke(session.id, 'admin-id')

      // El SessionsService recibió el jti de la sesión
      expect(sessionsSvc.revoke).toHaveBeenCalledWith('jti-target')

      // Evento disparado con revoked_by_user_id correcto
      const ev = events.logged.find((e) => e.eventType === 'auth.session.revoked_by_admin')
      expect(ev).toBeDefined()
      expect(ev?.actorUserId).toBe('admin-id')
      expect(ev?.payload.revokedByUserId).toBe('admin-id')
      expect(ev?.payload.userId).toBe('user-victim')
    })
  })
})
