import { UnauthorizedException } from '@nestjs/common'
import type { ExecutionContext } from '@nestjs/common'
import type { Reflector } from '@nestjs/core'
import jwt from 'jsonwebtoken'
import { AdminGuard, type AdminTokenPayload } from '@/common/auth/admin.guard'
import type { AppConfigService } from '@/core/config/config.service'

const SECRET = 'unit-test-secret-unit-test-secret-123456'

function makeGuard(isPublic: boolean): AdminGuard {
  const reflector = { getAllAndOverride: () => isPublic } as unknown as Reflector
  const cfg = { jwtSecret: SECRET } as AppConfigService
  return new AdminGuard(reflector, cfg)
}

function makeContext(headers: Record<string, string>): {
  ctx: ExecutionContext
  req: { headers: Record<string, string>; admin?: AdminTokenPayload }
} {
  const req: { headers: Record<string, string>; admin?: AdminTokenPayload } = { headers }
  const ctx = {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => null,
    getClass: () => null,
  } as unknown as ExecutionContext
  return { ctx, req }
}

describe('AdminGuard', () => {
  it('deja pasar una ruta @Public() sin token', () => {
    const guard = makeGuard(true)
    const { ctx } = makeContext({})
    expect(guard.canActivate(ctx)).toBe(true)
  })

  it('lanza 401 cuando no hay token', () => {
    const guard = makeGuard(false)
    const { ctx } = makeContext({})
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException)
  })

  it('lanza 401 cuando el esquema no es Bearer', () => {
    const guard = makeGuard(false)
    const { ctx } = makeContext({ authorization: 'Basic abc' })
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException)
  })

  it('lanza 401 con token de firma inválida', () => {
    const guard = makeGuard(false)
    const bad = jwt.sign({ sub: 'x' }, 'otro-secreto-distinto-distinto-1234567')
    const { ctx } = makeContext({ authorization: `Bearer ${bad}` })
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException)
  })

  it('lanza 401 con token expirado', () => {
    const guard = makeGuard(false)
    const expired = jwt.sign({ sub: 'x' }, SECRET, { expiresIn: -10 })
    const { ctx } = makeContext({ authorization: `Bearer ${expired}` })
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException)
  })

  it('pasa con token válido y adjunta el payload a req.admin', () => {
    const guard = makeGuard(false)
    const token = jwt.sign({ sub: 'admin-1', role: 'admin' }, SECRET)
    const { ctx, req } = makeContext({ authorization: `Bearer ${token}` })

    expect(guard.canActivate(ctx)).toBe(true)
    expect(req.admin?.sub).toBe('admin-1')
    expect(req.admin?.role).toBe('admin')
  })
})
