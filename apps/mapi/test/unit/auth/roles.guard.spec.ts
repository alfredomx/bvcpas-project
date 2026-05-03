import type { ExecutionContext } from '@nestjs/common'
import type { Reflector } from '@nestjs/core'
import { RolesGuard } from '../../../src/core/auth/guards/roles.guard'
import type { SessionContext } from '../../../src/core/auth/sessions.service'
import type { UserRole } from '../../../src/db/schema/users'
import { InsufficientPermissionsError } from '../../../src/modules/10-core-auth/errors'

/**
 * Tests Tipo A para RolesGuard.
 *
 * Cobertura:
 * - CR-auth-020: viewer en endpoint admin → InsufficientPermissionsError.
 * - CR-auth-021: admin en endpoint admin → pasa.
 */

interface MockRequest {
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

function buildReflector(required: UserRole[] | undefined): Reflector {
  return {
    getAllAndOverride: jest.fn().mockReturnValue(required),
  } as unknown as Reflector
}

function buildUser(role: UserRole): SessionContext {
  return { userId: 'u', email: 'a@b.com', role, jti: 'j' }
}

describe('RolesGuard', () => {
  it('endpoint sin @Roles() pasa sin chequear', () => {
    const guard = new RolesGuard(buildReflector(undefined))
    const ctx = buildContext({ user: buildUser('viewer') })

    expect(guard.canActivate(ctx)).toBe(true)
  })

  it('endpoint con @Roles() vacío pasa sin chequear', () => {
    const guard = new RolesGuard(buildReflector([]))
    const ctx = buildContext({ user: buildUser('viewer') })

    expect(guard.canActivate(ctx)).toBe(true)
  })

  describe('CR-auth-020: viewer rechazado en admin endpoint', () => {
    it('viewer + @Roles("admin") → InsufficientPermissionsError', () => {
      const guard = new RolesGuard(buildReflector(['admin']))
      const ctx = buildContext({ user: buildUser('viewer') })

      expect(() => guard.canActivate(ctx)).toThrow(InsufficientPermissionsError)
    })
  })

  describe('CR-auth-021: admin pasa', () => {
    it('admin + @Roles("admin") → true', () => {
      const guard = new RolesGuard(buildReflector(['admin']))
      const ctx = buildContext({ user: buildUser('admin') })

      expect(guard.canActivate(ctx)).toBe(true)
    })

    it('admin + @Roles("admin", "viewer") → true', () => {
      const guard = new RolesGuard(buildReflector(['admin', 'viewer']))
      const ctx = buildContext({ user: buildUser('admin') })

      expect(guard.canActivate(ctx)).toBe(true)
    })

    it('viewer + @Roles("admin", "viewer") → true', () => {
      const guard = new RolesGuard(buildReflector(['admin', 'viewer']))
      const ctx = buildContext({ user: buildUser('viewer') })

      expect(guard.canActivate(ctx)).toBe(true)
    })
  })

  describe('defensa', () => {
    it('sin user en request → InsufficientPermissionsError', () => {
      const guard = new RolesGuard(buildReflector(['admin']))
      const ctx = buildContext({ user: undefined })

      expect(() => guard.canActivate(ctx)).toThrow(InsufficientPermissionsError)
    })
  })
})
