import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { Request } from 'express'
import { JwtService } from '../jwt.service'
import { SessionsService, type SessionContext } from '../sessions.service'
import { IS_PUBLIC_KEY } from '../../../common/decorators/public.decorator'

/**
 * Guard global que valida JWT y sesión activa para todos los endpoints
 * EXCEPTO los marcados con @Public().
 *
 * Flujo:
 * 1. Si endpoint @Public(), pasa sin validar.
 * 2. Lee header Authorization: Bearer <jwt>. Si falta → 401.
 * 3. JwtService.verify(token) — si firma inválida o expirado → 401.
 * 4. SessionsService.verify(jti) — propaga errores de dominio
 *    (SessionNotFoundError, SessionRevokedError, SessionExpiredError,
 *    UserDisabledError) que el DomainErrorFilter mapea a 401.
 * 5. Inyecta `req.user = SessionContext` para uso de @CurrentUser y guards
 *    siguientes.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly sessions: SessionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (isPublic) {
      return true
    }

    const req = context.switchToHttp().getRequest<Request & { user?: SessionContext }>()
    const token = this.extractToken(req)
    if (!token) {
      throw new UnauthorizedException('Bearer token requerido')
    }

    let payload
    try {
      payload = this.jwt.verify(token)
    } catch {
      throw new UnauthorizedException('JWT inválido o expirado')
    }

    // Propaga errores de dominio (SessionNotFoundError, SessionRevokedError,
    // etc.) — el DomainErrorFilter los mapea a HTTP status apropiado.
    const ctx = await this.sessions.verify(payload.jti)
    req.user = ctx

    // Async: actualiza last_seen_at con debounce (no awaitea para no
    // ralentizar la request).
    this.sessions.touchLastSeen(payload.jti).catch(() => {
      // swallow: no es crítico para la request actual.
    })

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
