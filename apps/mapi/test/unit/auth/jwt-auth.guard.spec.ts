import type { ExecutionContext } from '@nestjs/common'
import { UnauthorizedException } from '@nestjs/common'
import type { Reflector } from '@nestjs/core'
import { JwtAuthGuard } from '../../../src/core/auth/guards/jwt-auth.guard'
import { JwtService } from '../../../src/core/auth/jwt.service'
import type { SessionsService, SessionContext } from '../../../src/core/auth/sessions.service'
import type { AppConfigService } from '../../../src/core/config/config.service'

/**
 * Tests Tipo A para JwtAuthGuard.
 *
 * Cobertura:
 * - CR-auth-010: JWT firma inválida → UnauthorizedException.
 * - CR-auth-022: endpoint @Public() pasa sin JWT.
 * - happy path con JWT válido + sesión activa → req.user inyectado.
 */

const SECRET = 'test_jwt_secret_at_least_32_chars_long_for_tests_only'

function buildJwt(): JwtService {
  return new JwtService({
    jwtSecret: SECRET,
    jwtExpiresIn: '7d',
  } as AppConfigService)
}

interface MockRequest {
  headers: { authorization?: string }
  user?: SessionContext
}

function buildContext(req: MockRequest): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: <T = MockRequest>(): T => req as T,
    }),
    getHandler: () => () => undefined,
    getClass: () => class TestController {},
  } as unknown as ExecutionContext
}

function buildReflector(isPublic = false): Reflector {
  return {
    getAllAndOverride: jest.fn().mockReturnValue(isPublic),
  } as unknown as Reflector
}

function buildSessions(
  opts: { verifyResult?: SessionContext; verifyThrows?: Error } = {},
): SessionsService {
  return {
    verify: jest.fn(() => {
      if (opts.verifyThrows) return Promise.reject(opts.verifyThrows)
      return Promise.resolve(
        opts.verifyResult ?? {
          userId: 'u-1',
          email: 'a@b.com',
          role: 'admin',
          jti: 'j-1',
        },
      )
    }),
    touchLastSeen: jest.fn().mockResolvedValue(undefined),
  } as unknown as SessionsService
}

describe('JwtAuthGuard', () => {
  describe('CR-auth-022: @Public() endpoints', () => {
    it('endpoint @Public() pasa sin JWT', async () => {
      const guard = new JwtAuthGuard(buildReflector(true), buildJwt(), buildSessions())
      const ctx = buildContext({ headers: {} })

      await expect(guard.canActivate(ctx)).resolves.toBe(true)
    })
  })

  describe('CR-auth-010: JWT inválido', () => {
    it('sin Authorization header → UnauthorizedException', async () => {
      const guard = new JwtAuthGuard(buildReflector(false), buildJwt(), buildSessions())
      const ctx = buildContext({ headers: {} })

      await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException)
    })

    it('Authorization sin Bearer scheme → UnauthorizedException', async () => {
      const guard = new JwtAuthGuard(buildReflector(false), buildJwt(), buildSessions())
      const ctx = buildContext({ headers: { authorization: 'Token abc' } })

      await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException)
    })

    it('JWT con firma inválida → UnauthorizedException', async () => {
      const jwt = buildJwt()
      const valid = jwt.sign({ sub: 'u', email: 'a@b.com', role: 'admin', jti: 'j' })
      const tampered = `${valid.split('.').slice(0, 2).join('.')}.invalid`

      const guard = new JwtAuthGuard(buildReflector(false), jwt, buildSessions())
      const ctx = buildContext({ headers: { authorization: `Bearer ${tampered}` } })

      await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException)
    })
  })

  describe('happy path', () => {
    it('JWT válido + sesión activa → inyecta req.user', async () => {
      const jwt = buildJwt()
      const token = jwt.sign({ sub: 'u-1', email: 'a@b.com', role: 'admin', jti: 'j-1' })

      const sessions = buildSessions({
        verifyResult: { userId: 'u-1', email: 'a@b.com', role: 'admin', jti: 'j-1' },
      })

      const req: MockRequest = { headers: { authorization: `Bearer ${token}` } }
      const guard = new JwtAuthGuard(buildReflector(false), jwt, sessions)
      const ctx = buildContext(req)

      await expect(guard.canActivate(ctx)).resolves.toBe(true)
      expect(req.user).toEqual({
        userId: 'u-1',
        email: 'a@b.com',
        role: 'admin',
        jti: 'j-1',
      })
    })

    it('SessionsService.verify() lanza error de dominio → propaga', async () => {
      const jwt = buildJwt()
      const token = jwt.sign({ sub: 'u', email: 'a@b.com', role: 'admin', jti: 'j-revoked' })

      const sessionRevokedError = new Error('Session revoked')
      const sessions = buildSessions({ verifyThrows: sessionRevokedError })

      const guard = new JwtAuthGuard(buildReflector(false), jwt, sessions)
      const ctx = buildContext({ headers: { authorization: `Bearer ${token}` } })

      await expect(guard.canActivate(ctx)).rejects.toThrow('Session revoked')
    })
  })
})
