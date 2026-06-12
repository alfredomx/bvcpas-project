import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe'
import { CurrentUser } from '../../../core/auth/decorators/current-user.decorator'
import type { SessionContext } from '../../../core/auth/sessions.service'
import { RequirePermission } from '../../../core/permissions/decorators/require-permission.decorator'
import { PermissionsService } from '../../../core/permissions/permissions.service'
import type { Role } from '../../../db/schema/roles'
import {
  CreateRoleDto,
  CreateRoleSchema,
  RoleDto,
  RolesListResponseDto,
  UpdateRoleDto,
  UpdateRoleSchema,
} from '../dto/permissions.dto'

function serialize(r: Role): RoleDto {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    is_system: r.isSystem,
    created_at: r.createdAt.toISOString(),
    updated_at: r.updatedAt.toISOString(),
  }
}

/**
 * CRUD de roles RBAC. Los roles del sistema (`Administrator`, `Viewer`)
 * son inmutables — intentar editarlos o eliminarlos devuelve 403
 * `SYSTEM_ROLE_NOT_EDITABLE`.
 */
@ApiTags('Permissions')
@ApiBearerAuth('bearer')
@Controller('permissions/roles')
@RequirePermission('system.roles.manage')
export class RolesController {
  constructor(private readonly permissions: PermissionsService) {}

  @Get()
  @ApiOperation({
    summary: 'GET /v1/permissions/roles',
    description: 'Lista todos los roles del sistema ordenados por nombre.',
  })
  @ApiResponse({ status: 200, type: RolesListResponseDto })
  async list(): Promise<RolesListResponseDto> {
    const items = await this.permissions.listRoles()
    return { data: items.map(serialize) }
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'POST /v1/permissions/roles',
    description: 'Crea un rol nuevo. El rol queda sin permisos hasta que se asignen.',
  })
  @ApiResponse({ status: 201, type: RoleDto })
  @ApiResponse({ status: 409, description: 'Ya existe un rol con ese nombre' })
  async create(
    @Body(new ZodValidationPipe(CreateRoleSchema)) dto: CreateRoleDto,
  ): Promise<RoleDto> {
    const role = await this.permissions.createRole({
      name: dto.name,
      description: dto.description ?? null,
    })
    return serialize(role)
  }

  @Get(':roleId')
  @ApiOperation({ summary: 'GET /v1/permissions/roles/:roleId' })
  @ApiResponse({ status: 200, type: RoleDto })
  @ApiResponse({ status: 404, description: 'Rol no encontrado' })
  async getOne(@Param('roleId', ParseUUIDPipe) roleId: string): Promise<RoleDto> {
    const role = await this.permissions.getRoleById(roleId)
    return serialize(role)
  }

  @Patch(':roleId')
  @ApiOperation({
    summary: 'PATCH /v1/permissions/roles/:roleId',
    description: 'Edita name y/o description. Falla 403 si el rol es del sistema.',
  })
  @ApiResponse({ status: 200, type: RoleDto })
  @ApiResponse({ status: 403, description: 'No editable (rol del sistema)' })
  @ApiResponse({ status: 404, description: 'Rol no encontrado' })
  @ApiResponse({ status: 409, description: 'El nuevo nombre choca con otro rol existente' })
  async update(
    @Param('roleId', ParseUUIDPipe) roleId: string,
    @Body(new ZodValidationPipe(UpdateRoleSchema)) dto: UpdateRoleDto,
    @CurrentUser() _actor: SessionContext,
  ): Promise<RoleDto> {
    const updated = await this.permissions.updateRole(roleId, {
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.description !== undefined ? { description: dto.description } : {}),
    })
    return serialize(updated)
  }

  @Delete(':roleId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'DELETE /v1/permissions/roles/:roleId',
    description:
      'Elimina el rol. Cascade: borra todas las `role_permissions` y `user_roles` asociadas. Falla 403 si el rol es del sistema.',
  })
  @ApiResponse({ status: 204, description: 'Rol eliminado' })
  @ApiResponse({ status: 403, description: 'No eliminable (rol del sistema)' })
  @ApiResponse({ status: 404, description: 'Rol no encontrado' })
  async delete(@Param('roleId', ParseUUIDPipe) roleId: string): Promise<void> {
    await this.permissions.deleteRole(roleId)
  }
}
