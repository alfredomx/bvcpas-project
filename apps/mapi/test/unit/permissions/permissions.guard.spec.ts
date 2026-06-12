import type { ExecutionContext } from '@nestjs/common'
import type { Reflector } from '@nestjs/core'
import { PermissionsGuard } from '../../../src/core/permissions/guards/permissions.guard'
import type { PermissionsService } from '../../../src/core/permissions/permissions.service'
import { InsufficientPermissionsError } from '../../../src/modules/10-core-auth/errors'

/**
 * Tests Tipo A — PermissionsGuard.
 *
 * Cobertura:
 * - Endpoint sin @RequirePermission → pasa sin chequear (default permisivo).
 * - Endpoint con @RequirePermission y user con uno de los codes → pasa.
 * - Endpoint con N codes (OR) → basta tener UNO.
 * - User sin ningún code → InsufficientPermissionsError (403).
 * - Endpoint con @RequirePermission pero sin req.user (defensa) → 403.
 * - Cache miss en service: el guard hace una sola call.
 */

interface Mocks {
  reflector: jest.Mocked<Reflector>
  permissions: jest.Mocked<PermissionsService>
}

function makeMocks(requiredFromReflector: string[] | undefined, effectiveCodes: string[]): Mocks {
  return {
    reflector: {
      getAllAndOverride: jest.fn().mockReturnValue(requiredFromReflector),
    } as unknown as jest.Mocked<Reflector>,
    permissions: {
      getEffectivePermissionCodes: jest.fn().mockResolvedValue(effectiveCodes),
    } as unknown as jest.Mocked<PermissionsService>,
  }
}

function buildContext(opts: { user?: { userId: string } | undefined }): ExecutionContext {
  const req = {
    user: opts.user,
  }
  return {
    switchToHttp: () => ({
      getRequest: () => req,
    }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext
}

describe('PermissionsGuard', () => {
  it('endpoint sin @RequirePermission pasa sin chequear', async () => {
    const m = makeMocks(undefined, [])
    const guard = new PermissionsGuard(m.reflector, m.permissions)
    const ctx = buildContext({ user: { userId: 'u1' } })

    await expect(guard.canActivate(ctx)).resolves.toBe(true)
    // No debe consultar permisos efectivos si no se requirió ninguno.
    expect(m.permissions.getEffectivePermissionCodes).not.toHaveBeenCalled()
  })

  it('endpoint con @RequirePermission([]) (array vacío) pasa sin chequear', async () => {
    const m = makeMocks([], [])
    const guard = new PermissionsGuard(m.reflector, m.permissions)
    const ctx = buildContext({ user: { userId: 'u1' } })

    await expect(guard.canActivate(ctx)).resolves.toBe(true)
    expect(m.permissions.getEffectivePermissionCodes).not.toHaveBeenCalled()
  })

  it('user con el permission requerido pasa', async () => {
    const m = makeMocks(['banking.read'], ['banking.read', 'banking.update'])
    const guard = new PermissionsGuard(m.reflector, m.permissions)
    const ctx = buildContext({ user: { userId: 'u1' } })

    await expect(guard.canActivate(ctx)).resolves.toBe(true)
    expect(m.permissions.getEffectivePermissionCodes).toHaveBeenCalledTimes(1)
    expect(m.permissions.getEffectivePermissionCodes).toHaveBeenCalledWith('u1')
  })

  it('OR semantics: con varios codes requeridos basta tener uno', async () => {
    const m = makeMocks(['system.users.manage', 'system.roles.manage'], ['system.roles.manage'])
    const guard = new PermissionsGuard(m.reflector, m.permissions)
    const ctx = buildContext({ user: { userId: 'u1' } })

    await expect(guard.canActivate(ctx)).resolves.toBe(true)
  })

  it('user sin ningún code requerido → InsufficientPermissionsError', async () => {
    const m = makeMocks(['banking.delete'], ['banking.read', 'banking.update'])
    const guard = new PermissionsGuard(m.reflector, m.permissions)
    const ctx = buildContext({ user: { userId: 'u1' } })

    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(InsufficientPermissionsError)
  })

  it('sin req.user pero con @RequirePermission → InsufficientPermissionsError (defensa)', async () => {
    const m = makeMocks(['banking.read'], [])
    const guard = new PermissionsGuard(m.reflector, m.permissions)
    const ctx = buildContext({ user: undefined })

    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(InsufficientPermissionsError)
    // No debe pegarle al service si no hay user.
    expect(m.permissions.getEffectivePermissionCodes).not.toHaveBeenCalled()
  })

  it('user con permisos vacíos (lista vacía) → InsufficientPermissionsError', async () => {
    const m = makeMocks(['clients.read'], [])
    const guard = new PermissionsGuard(m.reflector, m.permissions)
    const ctx = buildContext({ user: { userId: 'u1' } })

    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(InsufficientPermissionsError)
  })

  it('una sola llamada al service por request (no consulta dos veces)', async () => {
    const m = makeMocks(['banking.read', 'banking.update'], ['banking.read'])
    const guard = new PermissionsGuard(m.reflector, m.permissions)
    const ctx = buildContext({ user: { userId: 'u1' } })

    await guard.canActivate(ctx)
    expect(m.permissions.getEffectivePermissionCodes).toHaveBeenCalledTimes(1)
  })
})
