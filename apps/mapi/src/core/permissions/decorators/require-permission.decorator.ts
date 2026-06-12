import { SetMetadata } from '@nestjs/common'
import type { PermissionCode } from '../permissions.registry'

/**
 * Decorator para marcar endpoints/controllers con permisos requeridos.
 *
 * El `PermissionsGuard` lee esta metadata y valida contra los permisos
 * efectivos del user autenticado (rol + overrides individuales).
 *
 * Si el endpoint NO tiene @RequirePermission, el guard pasa sin chequear.
 * (Reservado para endpoints como /v1/healthz que ya son @Public).
 *
 * Si el endpoint tiene @RequirePermission con N codes, el user debe
 * tener AL MENOS UNO de ellos para pasar (semántica OR, no AND).
 *
 * Uso típico:
 *
 *   @RequirePermission('banking.delete')
 *   @Delete(':id')
 *   async delete(@Param('id') id: string) { ... }
 *
 * Múltiples codes (cualquiera basta):
 *
 *   @RequirePermission('clients.update', 'system.users.manage')
 *   @Patch(':id')
 *   async update(...) { ... }
 *
 * A nivel controller (heredan todos los métodos):
 *
 *   @Controller('v1/banking/credentials')
 *   @RequirePermission('banking.read')
 *   export class BankingCredentialsController { ... }
 *
 * El tipo `PermissionCode` viene del registry — TypeScript rechaza
 * codes que no existan en `src/core/permissions/permissions.registry.ts`.
 */
export const PERMISSIONS_KEY = 'requiredPermissions'
export const RequirePermission = (...codes: PermissionCode[]): MethodDecorator & ClassDecorator =>
  SetMetadata(PERMISSIONS_KEY, codes)
