import { SetMetadata } from '@nestjs/common'
import type { UserRole } from '../../../db/schema/users'

/**
 * Decorator para marcar endpoints/controllers con roles requeridos.
 * El RolesGuard lee esta metadata y compara contra `req.user.role`.
 *
 * Uso a nivel controller (todos los métodos heredan):
 *   @Controller('admin/users')
 *   @Roles('admin')
 *
 * Uso a nivel método (override controller):
 *   @Roles('admin', 'viewer')
 *   @Get(':id')
 */
export const ROLES_KEY = 'requiredRoles'
export const Roles = (...roles: UserRole[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles)
