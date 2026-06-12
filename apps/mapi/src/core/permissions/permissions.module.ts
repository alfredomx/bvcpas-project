import { Global, Module } from '@nestjs/common'
import { PermissionsService } from './permissions.service'
import { PermissionsRepository } from './permissions.repository'
import { PermissionsGuard } from './guards/permissions.guard'

/**
 * Módulo global RBAC. Provee el servicio, repositorio y guard de
 * permisos para que cualquier módulo del backend pueda usarlos sin
 * importar este módulo explícitamente.
 *
 * El `PermissionsGuard` NO se registra como APP_GUARD aquí — eso se
 * hace en `AppModule` al final del Bloque 3 (cuando se reemplaza al
 * `RolesGuard` actual). Por ahora se exporta para registro manual.
 *
 * Decisión D-mapi-PRM-002: módulo separado de `10-core-auth`.
 */
@Global()
@Module({
  providers: [PermissionsRepository, PermissionsService, PermissionsGuard],
  exports: [PermissionsRepository, PermissionsService, PermissionsGuard],
})
export class PermissionsModule {}
