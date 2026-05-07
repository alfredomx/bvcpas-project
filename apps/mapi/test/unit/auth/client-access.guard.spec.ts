import type { ExecutionContext } from '@nestjs/common'
import type { Reflector } from '@nestjs/core'
import { ClientAccessGuard } from '../../../src/core/auth/guards/client-access.guard'
import { ClientNotFoundError } from '../../../src/modules/11-clients/clients.errors'
import type { ClientAccessRepository } from '../../../src/modules/11-clients/client-access.repository'

/**
 * Tests Tipo A para ClientAccessGuard.
 *
 * Cobertura:
 * - CR-conn-034: user con acceso → canActivate=true.
 * - CR-conn-035: user sin acceso → ClientNotFoundError (404).
 * - CR-conn-036: cliente que no existe → ClientNotFoundError (404, mismo path).
 * - CR-conn-037: si no hay :id en path, el guard pasa (no aplica).
 * - CR-conn-038: si no hay user (endpoint @Public) el guard pasa.
 */

interface Mocks {
  reflector: jest.Mocked<Reflector>
  accessRepo: jest.Mocked<ClientAccessRepository>
}

function makeMocks(paramName: string | undefined = 'id'): Mocks {
  return {
    reflector: {
      getAllAndOverride: jest.fn().mockReturnValue(paramName),
    } as unknown as jest.Mocked<Reflector>,
    accessRepo: {
      hasAccess: jest.fn(),
      listClientIdsForUser: jest.fn(),
      grant: jest.fn(),
      revoke: jest.fn(),
    } as unknown as jest.Mocked<ClientAccessRepository>,
  }
}

function buildContext(opts: {
  user?: { userId: string } | undefined
  params?: Record<string, string>
}): ExecutionContext {
  const req = {
    user: opts.user,
    params: opts.params ?? {},
  }
  return {
    switchToHttp: () => ({
      getRequest: () => req,
    }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext
}

function buildGuard(m: Mocks): ClientAccessGuard {
  return new ClientAccessGuard(m.reflector, m.accessRepo)
}

describe('ClientAccessGuard', () => {
  describe('CR-conn-034 — user con acceso', () => {
    it('canActivate devuelve true', async () => {
      const m = makeMocks()
      m.accessRepo.hasAccess.mockResolvedValueOnce(true)
      const guard = buildGuard(m)

      const ctx = buildContext({
        user: { userId: 'user-1' },
        params: { id: 'client-abc' },
      })

      await expect(guard.canActivate(ctx)).resolves.toBe(true)
      expect(m.accessRepo.hasAccess).toHaveBeenCalledWith('user-1', 'client-abc')
    })
  })

  describe('CR-conn-035 — user sin acceso', () => {
    it('lanza ClientNotFoundError (404)', async () => {
      const m = makeMocks()
      m.accessRepo.hasAccess.mockResolvedValueOnce(false)
      const guard = buildGuard(m)

      const ctx = buildContext({
        user: { userId: 'user-1' },
        params: { id: 'client-abc' },
      })

      await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(ClientNotFoundError)
    })
  })

  describe('CR-conn-036 — cliente inexistente (mismo path que sin acceso)', () => {
    it('hasAccess=false (no hay row) → ClientNotFoundError, indistinguible de "sin acceso"', async () => {
      const m = makeMocks()
      m.accessRepo.hasAccess.mockResolvedValueOnce(false)
      const guard = buildGuard(m)

      const ctx = buildContext({
        user: { userId: 'user-1' },
        params: { id: 'client-no-existe' },
      })

      await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(ClientNotFoundError)
    })
  })

  describe('CR-conn-037 — no hay param de cliente', () => {
    it('canActivate=true sin consultar accessRepo', async () => {
      const m = makeMocks()
      const guard = buildGuard(m)

      const ctx = buildContext({
        user: { userId: 'user-1' },
        params: {}, // sin :id
      })

      await expect(guard.canActivate(ctx)).resolves.toBe(true)
      expect(m.accessRepo.hasAccess).not.toHaveBeenCalled()
    })
  })

  describe('CR-conn-038 — endpoint @Public sin user', () => {
    it('canActivate=true sin consultar accessRepo', async () => {
      const m = makeMocks()
      const guard = buildGuard(m)

      const ctx = buildContext({
        user: undefined,
        params: { id: 'client-abc' },
      })

      await expect(guard.canActivate(ctx)).resolves.toBe(true)
      expect(m.accessRepo.hasAccess).not.toHaveBeenCalled()
    })
  })

  describe('CR-conn-039 — paramName custom (@ClientIdParam("clientId"))', () => {
    it('lee :clientId en lugar de :id si Reflector lo indica', async () => {
      const m = makeMocks('clientId')
      m.accessRepo.hasAccess.mockResolvedValueOnce(true)
      const guard = buildGuard(m)

      const ctx = buildContext({
        user: { userId: 'user-1' },
        params: { clientId: 'client-xyz' },
      })

      await expect(guard.canActivate(ctx)).resolves.toBe(true)
      expect(m.accessRepo.hasAccess).toHaveBeenCalledWith('user-1', 'client-xyz')
    })
  })
})
