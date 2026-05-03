import { SessionsService } from '../../../src/core/auth/sessions.service'
import { JwtService } from '../../../src/core/auth/jwt.service'
import type { AppConfigService } from '../../../src/core/config/config.service'
import type { DrizzleDb } from '../../../src/core/db/db.module'
import type Redis from 'ioredis'
import {
  SessionExpiredError,
  SessionNotFoundError,
  SessionRevokedError,
  UserDisabledError,
} from '../../../src/modules/auth/errors'

/**
 * Tests Tipo A para SessionsService.
 *
 * Cobertura:
 * - CR-auth-004: create() inserta row con jti, retorna JWT con ese jti.
 * - CR-auth-011: verify() con jti inexistente → SessionNotFoundError.
 * - CR-auth-012: verify() con session revoked → SessionRevokedError.
 * - CR-auth-013: verify() con session expired → SessionExpiredError.
 * - CR-auth-014: revoke() invalida cache → próxima verify pega DB y ve revoked.
 * - CR-auth-015 (parcial): si DEL cache falla, TTL sigue cubriendo.
 *
 * Mock strategy: Drizzle query builder es difícil de mockear; uso una
 * fachada minimal donde cada test reemplaza solo los métodos que ese test
 * necesita.
 */

const TEST_JWT_SECRET = 'test_jwt_secret_at_least_32_chars_long_for_tests_only'

interface DbMock {
  insertReturning?: jest.Mock
  selectFromJoinWhereLimit?: jest.Mock
  updateSetWhere?: jest.Mock
  selectFromWhere?: jest.Mock
}

function buildDbMock(mock: DbMock): DrizzleDb {
  return {
    insert: () => ({
      values: () => ({
        returning: mock.insertReturning ?? jest.fn().mockResolvedValue([{ id: 'session-id' }]),
      }),
    }),
    select: () => ({
      from: () => ({
        innerJoin: () => ({
          where: () => ({
            limit: mock.selectFromJoinWhereLimit ?? jest.fn().mockResolvedValue([]),
          }),
        }),
        where: () => ({
          limit: mock.selectFromWhere ?? jest.fn().mockResolvedValue([]),
          // En revokeAllForUser, el select sin limit:
          [Symbol.asyncIterator]: undefined,
        }),
      }),
      // Para revokeAllForUser que usa: select({jti}).from().where(...)
    }),
    update: () => ({
      set: () => ({
        where: mock.updateSetWhere ?? jest.fn().mockResolvedValue(undefined),
      }),
    }),
  } as unknown as DrizzleDb
}

function buildRedisMock(opts: { initial?: Record<string, string>; failDel?: boolean } = {}): Redis {
  const store: Record<string, string> = { ...(opts.initial ?? {}) }
  return {
    get: jest.fn(async (key: string): Promise<string | null> => store[key] ?? null),
    set: jest.fn(async (key: string, value: string): Promise<'OK'> => {
      store[key] = value
      return 'OK'
    }),
    del: jest.fn(async (key: string): Promise<number> => {
      if (opts.failDel) {
        throw new Error('Redis DEL failed')
      }
      const existed = key in store
      delete store[key]
      return existed ? 1 : 0
    }),
  } as unknown as Redis
}

function buildCfg(jwtExpiresIn = '7d'): AppConfigService {
  return {
    jwtSecret: TEST_JWT_SECRET,
    jwtExpiresIn,
  } as AppConfigService
}

function buildJwt(): JwtService {
  return new JwtService(buildCfg())
}

describe('SessionsService', () => {
  describe('create (CR-auth-004)', () => {
    it('inserta row con jti generado y retorna JWT con ese jti', async () => {
      const insertReturning = jest.fn().mockResolvedValue([{ id: 'session-row-id' }])
      const db = buildDbMock({ insertReturning })
      const redis = buildRedisMock()
      const jwt = buildJwt()
      const cfg = buildCfg()

      const service = new SessionsService(db, redis, jwt, cfg)

      const result = await service.create({
        id: 'user-123',
        email: 'a@b.com',
        role: 'admin',
      })

      expect(result.jti).toBeDefined()
      expect(typeof result.jti).toBe('string')
      expect(result.token).toBeDefined()
      expect(result.token.split('.')).toHaveLength(3)
      expect(result.sessionId).toBe('session-row-id')

      const decoded = jwt.verify(result.token)
      expect(decoded.jti).toBe(result.jti)
      expect(decoded.sub).toBe('user-123')
      expect(decoded.role).toBe('admin')
    })
  })

  describe('verify (CR-auth-011, 012, 013)', () => {
    it('CR-auth-011: jti no existe → SessionNotFoundError', async () => {
      const selectFromJoinWhereLimit = jest.fn().mockResolvedValue([])
      const db = buildDbMock({ selectFromJoinWhereLimit })
      const redis = buildRedisMock()
      const service = new SessionsService(db, redis, buildJwt(), buildCfg())

      await expect(service.verify('jti-no-existe')).rejects.toThrow(SessionNotFoundError)
    })

    it('CR-auth-012: session revoked → SessionRevokedError', async () => {
      const selectFromJoinWhereLimit = jest.fn().mockResolvedValue([
        {
          userId: 'u',
          revokedAt: new Date(),
          expiresAt: new Date(Date.now() + 86400000),
          userEmail: 'a@b.com',
          userRole: 'admin',
          userStatus: 'active',
        },
      ])
      const db = buildDbMock({ selectFromJoinWhereLimit })
      const redis = buildRedisMock()
      const service = new SessionsService(db, redis, buildJwt(), buildCfg())

      await expect(service.verify('jti')).rejects.toThrow(SessionRevokedError)
    })

    it('CR-auth-013: session expired → SessionExpiredError', async () => {
      const selectFromJoinWhereLimit = jest.fn().mockResolvedValue([
        {
          userId: 'u',
          revokedAt: null,
          expiresAt: new Date(Date.now() - 1000),
          userEmail: 'a@b.com',
          userRole: 'admin',
          userStatus: 'active',
        },
      ])
      const db = buildDbMock({ selectFromJoinWhereLimit })
      const redis = buildRedisMock()
      const service = new SessionsService(db, redis, buildJwt(), buildCfg())

      await expect(service.verify('jti')).rejects.toThrow(SessionExpiredError)
    })

    it('user disabled → UserDisabledError', async () => {
      const selectFromJoinWhereLimit = jest.fn().mockResolvedValue([
        {
          userId: 'u',
          revokedAt: null,
          expiresAt: new Date(Date.now() + 86400000),
          userEmail: 'a@b.com',
          userRole: 'viewer',
          userStatus: 'disabled',
        },
      ])
      const db = buildDbMock({ selectFromJoinWhereLimit })
      const redis = buildRedisMock()
      const service = new SessionsService(db, redis, buildJwt(), buildCfg())

      await expect(service.verify('jti')).rejects.toThrow(UserDisabledError)
    })

    it('happy path retorna SessionContext y escribe cache', async () => {
      const selectFromJoinWhereLimit = jest.fn().mockResolvedValue([
        {
          userId: 'u-1',
          revokedAt: null,
          expiresAt: new Date(Date.now() + 86400000),
          userEmail: 'admin@x.com',
          userRole: 'admin',
          userStatus: 'active',
        },
      ])
      const db = buildDbMock({ selectFromJoinWhereLimit })
      const redis = buildRedisMock()
      const service = new SessionsService(db, redis, buildJwt(), buildCfg())

      const ctx = await service.verify('jti-happy')
      expect(ctx.userId).toBe('u-1')
      expect(ctx.email).toBe('admin@x.com')
      expect(ctx.role).toBe('admin')
      expect(ctx.jti).toBe('jti-happy')
      expect(redis.set).toHaveBeenCalled()
    })

    it('cache hit no pega a DB', async () => {
      const cached = JSON.stringify({
        userId: 'u-cached',
        email: 'c@x.com',
        role: 'viewer',
        status: 'active',
        expiresAt: Date.now() + 86400000,
      })
      const redis = buildRedisMock({ initial: { 'session:jti-cached': cached } })
      const selectFromJoinWhereLimit = jest.fn() // no se debe llamar
      const db = buildDbMock({ selectFromJoinWhereLimit })
      const service = new SessionsService(db, redis, buildJwt(), buildCfg())

      const ctx = await service.verify('jti-cached')
      expect(ctx.email).toBe('c@x.com')
      expect(selectFromJoinWhereLimit).not.toHaveBeenCalled()
    })

    it('cache hit con expiry pasado → SessionExpiredError + DEL cache', async () => {
      const cached = JSON.stringify({
        userId: 'u',
        email: 'a@b.com',
        role: 'viewer',
        status: 'active',
        expiresAt: Date.now() - 1000,
      })
      const redis = buildRedisMock({ initial: { 'session:jti-old': cached } })
      const db = buildDbMock({})
      const service = new SessionsService(db, redis, buildJwt(), buildCfg())

      await expect(service.verify('jti-old')).rejects.toThrow(SessionExpiredError)
      expect(redis.del).toHaveBeenCalledWith('session:jti-old')
    })
  })

  describe('revoke (CR-auth-014)', () => {
    it('marca revoked_at en DB e invalida cache Redis', async () => {
      const updateSetWhere = jest.fn().mockResolvedValue(undefined)
      const db = buildDbMock({ updateSetWhere })
      const redis = buildRedisMock({ initial: { 'session:jti-x': '{"some":"data"}' } })
      const service = new SessionsService(db, redis, buildJwt(), buildCfg())

      await service.revoke('jti-x')

      expect(updateSetWhere).toHaveBeenCalled()
      expect(redis.del).toHaveBeenCalledWith('session:jti-x')
    })
  })

  describe('revoke con DEL cache fallido (CR-auth-015 parcial)', () => {
    it('NO propaga error si Redis DEL falla', async () => {
      const db = buildDbMock({})
      const redis = buildRedisMock({ failDel: true })
      const service = new SessionsService(db, redis, buildJwt(), buildCfg())

      // No debe lanzar.
      await expect(service.revoke('jti')).resolves.toBeUndefined()
    })
  })
})
