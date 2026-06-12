import {
  Body,
  Controller,
  Delete,
  Get,
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
  GrantPermissionsToRoleDto,
  GrantPermissionsToRoleSchema,
  PermissionsListResponseDto,
} from '../dto/permissions.dto'

/**
 * Asignación de permisos a roles. Cambios invalidan el cache de TODOS
 * los usuarios que tienen este rol (vía `PermissionsService.invalidateUsersWithRole`).
 */
@ApiTags('Permissions')
@ApiBearerAuth('bearer')
@Controller('permissions/roles/:roleId/permissions')
@RequirePermission('system.roles.manage')
export class RolePermissionsController {
  constructor(private readonly permissions: PermissionsService) {}

  @Get()
  @ApiOperation({
    summary: 'GET /v1/permissions/roles/:roleId/permissions',
    description: 'Lista los permisos asignados al rol.',
  })
  @ApiResponse({ status: 200, type: PermissionsListResponseDto })
  @ApiResponse({ status: 404, description: 'Rol no encontrado' })
  async list(@Param('roleId', ParseUUIDPipe) roleId: string): Promise<PermissionsListResponseDto> {
    const data = await this.permissions.getRolePermissions(roleId)
    return { data }
  }

  @Post()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'POST /v1/permissions/roles/:roleId/permissions',
    description:
      'Otorga uno o más permisos al rol. Idempotente — si el rol ya tiene un permiso del set, se ignora silenciosamente. Falla 403 si el rol es del sistema.',
  })
  @ApiResponse({ status: 204, description: 'Permisos otorgados' })
  @ApiResponse({ status: 403, description: 'Rol del sistema no editable' })
  @ApiResponse({ status: 404, description: 'Rol o algún permission_code no encontrado' })
  async grant(
    @Param('roleId', ParseUUIDPipe) roleId: string,
    @Body(new ZodValidationPipe(GrantPermissionsToRoleSchema)) dto: GrantPermissionsToRoleDto,
    @CurrentUser() actor: SessionContext,
  ): Promise<void> {
    await this.permissions.grantPermissionsToRole(roleId, dto.permission_codes, actor.userId)
  }

  @Delete(':permissionCode')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'DELETE /v1/permissions/roles/:roleId/permissions/:permissionCode',
    description: 'Revoca un permiso del rol. Falla 403 si el rol es del sistema.',
  })
  @ApiResponse({ status: 204, description: 'Permiso revocado' })
  @ApiResponse({ status: 403, description: 'Rol del sistema no editable' })
  @ApiResponse({ status: 404, description: 'Rol o permission_code no encontrado' })
  async revoke(
    @Param('roleId', ParseUUIDPipe) roleId: string,
    @Param('permissionCode') permissionCode: string,
  ): Promise<void> {
    await this.permissions.revokePermissionFromRole(roleId, permissionCode)
  }
}
