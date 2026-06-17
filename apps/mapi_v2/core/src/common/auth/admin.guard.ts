import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { Request } from 'express'
import jwt from 'jsonwebtoken'
import { AppConfigService } from '@/core/config/config.service'
import { IS_PUBLIC_KEY } from './public.decorator'

/** Claims mínimos que el core lee del token admin. Slim: no valida sesión ni DB. */
export interface AdminTokenPayload {
  sub?: string
  role?: string
  [key: string]: unknown
}

/**
 * Guard slim: valida `Authorization: Bearer <jwt>` contra `JWT_SECRET`.
 *
 * - Si la ruta es `@Public()` → pasa sin token.
 * - Sin token o firma/expiración inválida → 401 (vía DomainErrorFilter).
 * - Token válido → adjunta el payload a `req.admin` y deja pasar.
 *
 * Slim a propósito: solo verifica el JWT. Sin sesiones, sin lookup en DB, sin
 * identidad de usuario (eso es de un plugin de auth real, diferido). Se registra
 * global (`APP_GUARD`) y también se exporta para `@UseGuards(AdminGuard)` directo.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly cfg: AppConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (isPublic) return true

    const req = context.switchToHttp().getRequest<Request & { admin?: AdminTokenPayload }>()
    const token = this.extractToken(req)
    if (!token) {
      throw new UnauthorizedException('Token admin requerido')
    }

    try {
      req.admin = jwt.verify(token, this.cfg.jwtSecret) as AdminTokenPayload
    } catch {
      throw new UnauthorizedException('Token admin inválido o expirado')
    }

    return true
  }

  private extractToken(req: Request): string | null {
    const header = req.headers.authorization
    if (!header) return null
    const [scheme, token] = header.split(' ')
    if (scheme !== 'Bearer' || !token) return null
    return token
  }
}
