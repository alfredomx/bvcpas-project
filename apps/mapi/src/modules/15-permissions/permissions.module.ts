import { Module } from '@nestjs/common'
import { PermissionsCatalogController } from './controllers/permissions-catalog.controller'
import { RolesController } from './controllers/roles.controller'
import { RolePermissionsController } from './controllers/role-permissions.controller'
import { UserRolesController } from './controllers/user-roles.controller'
import { UserPermissionsController } from './controllers/user-permissions.controller'
import { EffectivePermissionsController } from './controllers/effective-permissions.controller'

/**
 * Endpoints admin de gestión RBAC. Consumen `PermissionsService` que vive
 * en el módulo global `core/permissions/permissions.module.ts` — aquí solo
 * agrupamos los controllers que exponen la HTTP API.
 *
 * Separar `15-permissions` (HTTP) de `core/permissions` (service + guard
 * + cache) mantiene el guard accesible desde cualquier módulo sin
 * importar este. Decisión D-mapi-PRM-002.
 */
@Module({
  controllers: [
    PermissionsCatalogController,
    RolesController,
    RolePermissionsController,
    UserRolesController,
    UserPermissionsController,
    EffectivePermissionsController,
  ],
})
export class PermissionsHttpModule {}
