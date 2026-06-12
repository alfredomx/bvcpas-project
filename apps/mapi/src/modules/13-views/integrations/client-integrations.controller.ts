import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { ClientAccessGuard } from '../../../core/auth/guards/client-access.guard'
import { RequirePermission } from '../../../core/permissions/decorators/require-permission.decorator'
import { ClientIntegrationsResponseDto } from './dto/client-integrations.dto'
import { IntegrationsService } from './integrations.service'

/**
 * Dashboard de integraciones por cliente (v0.14.0).
 *
 * Devuelve las conexiones Clover/Square del cliente con su status derivado
 * y KPIs agregados para la pantalla "Integrations".
 *
 * Providers globales (Intuit, Microsoft, Dropbox, Google) NO aparecen aquí —
 * pertenecen a una vista futura aparte.
 */
@ApiTags('Clients - Integrations')
@ApiBearerAuth('bearer')
@Controller('clients/:id/integrations')
@RequirePermission('connections.read')
@UseGuards(ClientAccessGuard)
export class ClientIntegrationsController {
  constructor(private readonly service: IntegrationsService) {}

  @Get()
  @ApiOperation({
    summary: 'GET /v1/clients/:id/integrations',
    description:
      'Dashboard de integraciones del cliente. Lista conexiones Clover/Square con su status (healthy | needs_reauth | paused) y KPIs agregados (connected, healthy, needsAttention, errors, providersInUse). Status derivado en runtime desde columnas DB (no llama APIs externas). Para validar credenciales en vivo, el frontend usa POST /v1/connections/:id/test.',
  })
  @ApiResponse({ status: 200, type: ClientIntegrationsResponseDto })
  @ApiResponse({ status: 404, description: 'Cliente no encontrado o sin acceso' })
  async getIntegrations(
    @Param('id', ParseUUIDPipe) clientId: string,
  ): Promise<ClientIntegrationsResponseDto> {
    const result = await this.service.getDashboard(clientId)
    return result as unknown as ClientIntegrationsResponseDto
  }
}
