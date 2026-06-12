import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe'
import { CurrentUser } from '../../../core/auth/decorators/current-user.decorator'
import type { SessionContext } from '../../../core/auth/sessions.service'
import { RequirePermission } from '../../../core/permissions/decorators/require-permission.decorator'
import { PermissionsService } from '../../../core/permissions/permissions.service'
import {
  SetUserPermissionOverrideDto,
  SetUserPermissionOverrideSchema,
} from '../dto/permissions.dto'

/**
 * Overrides individuales de permisos por usuario. Caso motivador:
 * Lorena e Ileana ambas con rol "Bookkeeper" pero Lorena con override
 * `granted=true` para `banking.delete` (puede borrar) y Ileana sin
 * override (no puede).
 *
 * Reglas:
 * - `granted=true` agrega el permiso aunque su rol no lo tenga.
 * - `granted=false` niega el permiso aunque su rol sí lo tenga.
 * - Cambios invalidan SOLO el cache del usuario afectado.
 */
@ApiTags('Permissions')
@ApiBearerAuth('bearer')
@Controller('permissions/users/:userId/permissions')
@RequirePermission('system.users.manage')
export class UserPermissionsController {
  constructor(private readonly permissions: PermissionsService) {}

  @Post()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'POST /v1/permissions/users/:userId/permissions',
    description:
      'Crea un override individual para el usuario. Si ya existe un override para `(user, permission)`, falla 409 — para cambiarlo, eliminar el actual y crear uno nuevo.',
  })
  @ApiResponse({ status: 204, description: 'Override creado' })
  @ApiResponse({ status: 404, description: 'Permission code no existe en el catálogo' })
  @ApiResponse({ status: 409, description: 'Ya existe un override para este (user, permission)' })
  async set(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body(new ZodValidationPipe(SetUserPermissionOverrideSchema)) dto: SetUserPermissionOverrideDto,
    @CurrentUser() actor: SessionContext,
  ): Promise<void> {
    await this.permissions.setUserPermissionOverride({
      userId,
      permissionCode: dto.permission_code,
      granted: dto.granted,
      reason: dto.reason ?? null,
      grantedBy: actor.userId,
    })
  }

  @Delete(':permissionCode')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'DELETE /v1/permissions/users/:userId/permissions/:permissionCode',
    description:
      'Elimina el override. El permiso del usuario vuelve a depender únicamente de sus roles.',
  })
  @ApiResponse({ status: 204, description: 'Override eliminado (o no existía)' })
  @ApiResponse({ status: 404, description: 'Permission code no existe en el catálogo' })
  async unset(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('permissionCode') permissionCode: string,
  ): Promise<void> {
    await this.permissions.removeUserPermissionOverride(userId, permissionCode)
  }
}
