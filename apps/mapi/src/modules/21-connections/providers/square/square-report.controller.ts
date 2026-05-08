import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { ZodValidationPipe } from '../../../../common/pipes/zod-validation.pipe'
import { ClientAccessGuard } from '../../../../core/auth/guards/client-access.guard'
import { Roles } from '../../../../core/auth/decorators/roles.decorator'
import { z } from 'zod'
import { ConnectionsRepository } from '../../connections.repository'
import { ConnectionNotFoundError } from '../../connection.errors'
import { SquareReportQueryDto, SquareReportResponseDto } from './dto/square-report.dto'

const ReportQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date debe ser YYYY-MM-DD'),
})

/**
 * Endpoint placeholder del reporte Square por (cliente × location × fecha).
 *
 * Path bajo `/clients/:id/merchants/square/:locationId/reports`. La
 * conexión Square se busca por `(provider='square', clientId)` — UNA
 * conexión por merchant cubre N locations.
 *
 * v0.12.0: solo wiring + validación. Devuelve `{message:'ok'}`.
 * v0.12.1+: implementará la generación real.
 */
@ApiTags('Merchants - Square')
@ApiBearerAuth('bearer')
@Controller('clients/:id/merchants/square/:locationId/reports')
@Roles('admin')
@UseGuards(ClientAccessGuard)
export class SquareReportController {
  constructor(private readonly connectionsRepo: ConnectionsRepository) {}

  @Get()
  @ApiOperation({
    summary: 'GET /v1/clients/:id/merchants/square/:locationId/reports',
    description: 'Reporte custom Square para un (cliente × location × fecha). v0.12.0 placeholder.',
  })
  @ApiResponse({ status: 200, type: SquareReportResponseDto })
  @ApiResponse({ status: 404, description: 'Cliente o conexión Square no encontrada' })
  async report(
    @Param('id', ParseUUIDPipe) clientId: string,
    @Param('locationId') locationId: string,
    @Query(new ZodValidationPipe(ReportQuerySchema)) query: SquareReportQueryDto,
  ): Promise<SquareReportResponseDto> {
    // Buscar la única conexión Square del cliente.
    const conns = await this.connectionsRepo.listByProvider('square')
    const conn = conns.find((c) => c.clientId === clientId)
    if (!conn) {
      throw new ConnectionNotFoundError(`square/clientId=${clientId}`)
    }

    return {
      message: 'ok',
      clientId,
      locationId,
      merchantId: conn.externalAccountId,
      date: query.date,
    }
  }
}
