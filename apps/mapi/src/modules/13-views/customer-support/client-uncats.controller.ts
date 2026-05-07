import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe'
import { Roles } from '../../../core/auth/decorators/roles.decorator'
import {
  CustomerSupportDetailResponseDto,
  DashboardQueryDto,
  DashboardQuerySchema,
} from './dto/customer-support-dashboard.dto'
import { CustomerSupportDashboardService } from './customer-support-dashboard.service'

/**
 * Detalle de uncats por cliente. Forma C: las vistas POR CLIENTE
 * viven bajo `/v1/clients/:id/<vista>` (no bajo `/v1/views/`).
 *
 * Aunque el archivo y módulo son `13-views/`, este controller expone
 * un sub-recurso del cliente — D-mapi-019.
 */
@ApiTags('Clients - Uncats')
@ApiBearerAuth('bearer')
@Controller('clients/:id/uncats')
@Roles('admin')
export class ClientUncatsController {
  constructor(private readonly service: CustomerSupportDashboardService) {}

  @Get()
  @ApiOperation({
    summary: 'GET /v1/clients/:id/uncats',
    description:
      'Detalle del cliente para el panel central del dashboard de Customer Support. Stats + datos del cliente + followup + silent_streak_days. Requiere `from` y `to` (YYYY-MM-DD).',
  })
  @ApiResponse({ status: 200, type: CustomerSupportDetailResponseDto })
  @ApiResponse({ status: 404, description: 'Cliente no encontrado' })
  async detail(
    @Param('id', ParseUUIDPipe) clientId: string,
    @Query(new ZodValidationPipe(DashboardQuerySchema)) query: DashboardQueryDto,
  ): Promise<CustomerSupportDetailResponseDto> {
    const result = await this.service.getForClient(clientId, query)
    return {
      period: { from: query.from, to: query.to },
      ...result,
    } as CustomerSupportDetailResponseDto
  }
}
