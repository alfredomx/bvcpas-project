import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { ZodValidationPipe } from '../../../../common/pipes/zod-validation.pipe'
import { ClientAccessGuard } from '../../../../core/auth/guards/client-access.guard'
import { Roles } from '../../../../core/auth/decorators/roles.decorator'
import { z } from 'zod'
import { ConnectionsRepository } from '../../connections.repository'
import { ConnectionNotFoundError } from '../../connection.errors'
import { CloverReportQueryDto, CloverReportResponseDto } from './dto/clover-report.dto'

const ReportQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date debe ser YYYY-MM-DD'),
})

/**
 * Endpoint placeholder del reporte Clover por (cliente × merchant × fecha).
 *
 * Path bajo `/clients/:id/merchants/clover/:merchantId/reports` —
 * grupo "Merchants" en Scalar (junto a Square, Toast, DoorDash futuros).
 *
 * v0.11.0: solo wiring + validación de existencia de la conexión Clover
 * api_key asociada al cliente. Devuelve `{ message: 'ok' }` para validar
 * el flow.
 *
 * v0.11.1+: implementará la generación real (orders + payments + customers
 * + inventory) según especificación que el cliente defina.
 */
@ApiTags('Merchants - Clover')
@ApiBearerAuth('bearer')
@Controller('clients/:id/merchants/clover/:merchantId/reports')
@Roles('admin')
@UseGuards(ClientAccessGuard)
export class CloverReportController {
  constructor(private readonly connectionsRepo: ConnectionsRepository) {}

  @Get()
  @ApiOperation({
    summary: 'GET /v1/clients/:id/merchants/clover/:merchantId/reports',
    description:
      'Reporte custom de Clover para un (cliente × merchant × fecha). v0.11.0 devuelve placeholder; la generación real entra en v0.11.1+.',
  })
  @ApiResponse({ status: 200, type: CloverReportResponseDto })
  @ApiResponse({ status: 404, description: 'Cliente o conexión Clover no encontrada' })
  async report(
    @Param('id', ParseUUIDPipe) clientId: string,
    @Param('merchantId') merchantId: string,
    @Query(new ZodValidationPipe(ReportQuerySchema)) query: CloverReportQueryDto,
  ): Promise<CloverReportResponseDto> {
    // Validar que la conexión Clover (cliente × merchant) existe.
    const conn = await this.connectionsRepo.findByProviderAndExternalAccountId('clover', merchantId)
    if (conn?.clientId !== clientId) {
      throw new ConnectionNotFoundError(`clover/${merchantId}`)
    }

    return {
      message: 'ok',
      clientId,
      merchantId,
      date: query.date,
    }
  }
}
