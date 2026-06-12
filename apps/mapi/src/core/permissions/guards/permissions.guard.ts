import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { Request } from 'express'
import { PERMISSIONS_KEY } from '../decorators/require-permission.decorator'
import type { PermissionCode } from '../permissions.registry'
import { PermissionsService } from '../permissions.service'
import { InsufficientPermissionsError } from '../../../modules/10-core-auth/errors'
import type { SessionContext } from '../../auth/sessions.service'

/**
 * Guard global que valida que el user autenticado tenga AL MENOS UNO de
 * los permisos requeridos por el decorator @RequirePermission().
 *
 * Si el endpoint NO tiene @RequirePermission, pasa sin chequear (default
 * permisivo — los endpoints sin decorator son @Public o ya tienen otra
 * forma de auth).
 *
 * Semántica de múltiples codes en @RequirePermission(): **OR** (basta con
 * tener uno). Si necesitas AND, divide en múltiples decoradores o
 * endpoints separados.
 *
 * Asume que `JwtAuthGuard` corrió antes y dejó `req.user`. Si no hay
 * usuario autenticado pero el endpoint tiene @RequirePermission, lanza
 * InsufficientPermissionsError (no debería pasar en práctica — el
 * JwtAuthGuard ya rechaza).
 *
 * Lee permisos efectivos desde Redis vía `PermissionsService.getEffectivePermissionCodes`
 * (con cache TTL 15min y miss-recalculate desde DB).
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissions: PermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<PermissionCode[] | undefined>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    )
    if (!required || required.length === 0) {
      return true
    }

    const req = context.switchToHttp().getRequest<Request & { user?: SessionContext }>()
    const user = req.user
    if (!user) {
      // Defensa: JwtAuthGuard debería haber bloqueado.
      throw new InsufficientPermissionsError({ reason: 'no authenticated user' })
    }

    const effective = await this.permissions.getEffectivePermissionCodes(user.userId)
    const effectiveSet = new Set<string>(effective)

    const hasAny = required.some((code) => effectiveSet.has(code))
    if (!hasAny) {
      throw new InsufficientPermissionsError({
        requiredPermissions: required,
        userId: user.userId,
      })
    }

    return true
  }
}
