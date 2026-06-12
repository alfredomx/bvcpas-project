import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { RequirePermission } from '../../../core/permissions/decorators/require-permission.decorator'
import { PermissionsService } from '../../../core/permissions/permissions.service'
import type { Role } from '../../../db/schema/roles'
import { EffectivePermissionsResponseDto, RoleDto } from '../dto/permissions.dto'

function serializeRole(r: Role): RoleDto {
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
 * Vista efectiva de permisos de un usuario específico (admin only).
 * Aplica la fórmula completa: roles + grant overrides − deny overrides,
 * con wildcards expandidos literalmente (D-mapi-PRM-009).
 *
 * Endpoint similar pero NO equivalente a `/v1/auth/me/permissions` —
 * este es para que admin consulte permisos de otro usuario; el otro es
 * para que el user logueado consulte los suyos.
 */
@ApiTags('Permissions')
@ApiBearerAuth('bearer')
@Controller('permissions/users/:userId/effective')
@RequirePermission('system.users.manage')
export class EffectivePermissionsController {
  constructor(private readonly permissions: PermissionsService) {}

  @Get()
  @ApiOperation({
    summary: 'GET /v1/permissions/users/:userId/effective',
    description:
      'Devuelve roles asignados al usuario + sus permisos efectivos (expandidos, ya con overrides aplicados). Para que admin pueda inspeccionar qué puede hacer otro usuario.',
  })
  @ApiResponse({ status: 200, type: EffectivePermissionsResponseDto })
  async get(
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<EffectivePermissionsResponseDto> {
    const { roles, permissions } = await this.permissions.getEffectivePermissions(userId)
    return {
      roles: roles.map(serializeRole),
      permissions,
    }
  }
}
