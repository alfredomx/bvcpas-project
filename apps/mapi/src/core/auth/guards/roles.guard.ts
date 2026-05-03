import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { Request } from 'express'
import { ROLES_KEY } from '../decorators/roles.decorator'
import type { UserRole } from '../../../db/schema/users'
import type { SessionContext } from '../sessions.service'
import { InsufficientPermissionsError } from '../../../modules/auth/errors'

/**
 * Guard que valida que el user autenticado tenga uno de los roles
 * requeridos por el decorator @Roles().
 *
 * Si el endpoint NO tiene @Roles, pasa sin chequear (rol no requerido).
 * Si el user no tiene el rol → InsufficientPermissionsError (HTTP 403).
 *
 * Asume que JwtAuthGuard corrió antes y dejó `req.user`.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (!required || required.length === 0) {
      return true
    }

    const req = context.switchToHttp().getRequest<Request & { user?: SessionContext }>()
    const user = req.user
    if (!user) {
      // No debería pasar si JwtAuthGuard corrió antes. Defensa.
      throw new InsufficientPermissionsError({ reason: 'no authenticated user' })
    }

    if (!required.includes(user.role)) {
      throw new InsufficientPermissionsError({
        requiredRoles: required,
        userRole: user.role,
      })
    }

    return true
  }
}
