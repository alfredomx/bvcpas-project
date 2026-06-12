import { Controller, Get } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { RequirePermission } from '../../../core/permissions/decorators/require-permission.decorator'
import { PermissionsService } from '../../../core/permissions/permissions.service'
import { PermissionsGroupedResponseDto, PermissionsListResponseDto } from '../dto/permissions.dto'

/**
 * Catálogo de permisos del registry. Read-only — los permisos solo se
 * pueden agregar editando `permissions.registry.ts` + migration nueva.
 *
 * v0.15.1 (frontend) consumirá `GET /grouped` para armar la UI de
 * asignación de permisos a roles (checkboxes agrupados por módulo).
 */
@ApiTags('Permissions')
@ApiBearerAuth('bearer')
@Controller('permissions/permissions')
@RequirePermission('system.roles.manage')
export class PermissionsCatalogController {
  constructor(private readonly permissions: PermissionsService) {}

  @Get()
  @ApiOperation({
    summary: 'GET /v1/permissions/permissions',
    description:
      'Lista plana de los permisos atómicos del catálogo. Ordenados por module + code. Útil para auditoría o consumo programático.',
  })
  @ApiResponse({ status: 200, type: PermissionsListResponseDto })
  async list(): Promise<PermissionsListResponseDto> {
    const data = await this.permissions.listAllPermissions()
    return { data }
  }

  @Get('grouped')
  @ApiOperation({
    summary: 'GET /v1/permissions/permissions/grouped',
    description:
      'Catálogo agrupado por módulo (`system`, `clients`, `banking`, etc.). Diseñado para la UI de gestión de permisos por rol.',
  })
  @ApiResponse({ status: 200, type: PermissionsGroupedResponseDto })
  async grouped(): Promise<PermissionsGroupedResponseDto> {
    const modules = await this.permissions.listPermissionsGrouped()
    return { modules }
  }
}
