import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe'
import { Roles } from '../../../core/auth/decorators/roles.decorator'
import {
  CustomerSupportDetailResponseDto,
  CustomerSupportListResponseDto,
  DashboardQueryDto,
  DashboardQuerySchema,
} from './dto/customer-support-dashboard.dto'
import { CustomerSupportDashboardService } from './customer-support-dashboard.service'

@ApiTags('Dashboards')
@ApiBearerAuth('bearer')
@Controller('dashboards/customer-support')
@Roles('admin')
export class CustomerSupportDashboardController {
  constructor(private readonly service: CustomerSupportDashboardService) {}

  @Get()
  @ApiOperation({
    summary: '/v1/dashboards/customer-support',
    description:
      'Lista maestra de Customer Support: por cada cliente activo, devuelve stats agregados (uncats, amas, responded, amount, progress), distribución mensual del año actual y total del año anterior. Requiere `from` y `to` (YYYY-MM-DD).',
  })
  @ApiResponse({ status: 200, type: CustomerSupportListResponseDto })
  async list(
    @Query(new ZodValidationPipe(DashboardQuerySchema)) query: DashboardQueryDto,
  ): Promise<CustomerSupportListResponseDto> {
    const items = await this.service.listAll(query)
    return {
      period: { from: query.from, to: query.to },
      items,
    } as CustomerSupportListResponseDto
  }

  @Get(':clientId')
  @ApiOperation({
    summary: '/v1/dashboards/customer-support/:clientId',
    description:
      'Detalle del cliente para el panel central del dashboard. Stats + datos del cliente + followup + silent_streak_days. Requiere `from` y `to`.',
  })
  @ApiResponse({ status: 200, type: CustomerSupportDetailResponseDto })
  @ApiResponse({ status: 404, description: 'Cliente no encontrado' })
  async detail(
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @Query(new ZodValidationPipe(DashboardQuerySchema)) query: DashboardQueryDto,
  ): Promise<CustomerSupportDetailResponseDto> {
    const result = await this.service.getForClient(clientId, query)
    return {
      period: { from: query.from, to: query.to },
      ...result,
    } as CustomerSupportDetailResponseDto
  }
}
