import { Controller, Get, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe'
import { Roles } from '../../../core/auth/decorators/roles.decorator'
import {
  CustomerSupportListResponseDto,
  DashboardQueryDto,
  DashboardQuerySchema,
} from './dto/customer-support-dashboard.dto'
import { CustomerSupportDashboardService } from './customer-support-dashboard.service'

/**
 * Vista global agregada de uncats por cliente. Lista maestra de la
 * tab Customer Support del dashboard del operador (imagen 2).
 *
 * Forma C de URLs: las vistas globales viven bajo `/v1/views/<x>`. El
 * detalle por cliente vive en `ClientUncatsController` bajo
 * `/v1/clients/:id/uncats`.
 */
@ApiTags('Views')
@ApiBearerAuth('bearer')
@Controller('views/uncats')
@Roles('admin')
export class UncatsViewController {
  constructor(private readonly service: CustomerSupportDashboardService) {}

  @Get()
  @ApiOperation({
    summary: 'GET /v1/views/uncats',
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
}
