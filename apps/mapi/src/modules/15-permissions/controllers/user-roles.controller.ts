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
import { AssignRoleToUserDto, AssignRoleToUserSchema } from '../dto/permissions.dto'

/**
 * Asignación de roles a usuarios. Cambios invalidan cache del usuario.
 *
 * Regla operativa: un usuario NO puede quedar sin roles. Si se intenta
 * revocar el último rol, la operación falla con 422
 * `USER_MUST_HAVE_AT_LEAST_ONE_ROLE`.
 */
@ApiTags('Permissions')
@ApiBearerAuth('bearer')
@Controller('permissions/users/:userId/roles')
@RequirePermission('system.users.manage')
export class UserRolesController {
  constructor(private readonly permissions: PermissionsService) {}

  @Post()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'POST /v1/permissions/users/:userId/roles',
    description: 'Asigna un rol RBAC al usuario.',
  })
  @ApiResponse({ status: 204, description: 'Rol asignado' })
  @ApiResponse({ status: 404, description: 'Rol no encontrado' })
  @ApiResponse({ status: 409, description: 'El usuario ya tiene ese rol' })
  async assign(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body(new ZodValidationPipe(AssignRoleToUserSchema)) dto: AssignRoleToUserDto,
    @CurrentUser() actor: SessionContext,
  ): Promise<void> {
    await this.permissions.assignRoleToUser(userId, dto.role_id, actor.userId)
  }

  @Delete(':roleId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'DELETE /v1/permissions/users/:userId/roles/:roleId',
    description:
      'Revoca un rol del usuario. Falla 422 si es el último rol del usuario (debe tener al menos uno).',
  })
  @ApiResponse({ status: 204, description: 'Rol revocado' })
  @ApiResponse({ status: 422, description: 'No se puede revocar el último rol del usuario' })
  async revoke(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('roleId', ParseUUIDPipe) roleId: string,
  ): Promise<void> {
    await this.permissions.revokeRoleFromUser(userId, roleId)
  }
}
