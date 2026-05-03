import { Controller, Get, HttpCode, HttpStatus, Res } from '@nestjs/common'
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import type { Response } from 'express'
import { Public } from '../../common/decorators/public.decorator'
import { HealthService } from './health.service'
import { HealthResponseDto } from './dto/health-response.dto'

@ApiTags('Health')
@Controller('healthz')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  /**
   * Healthcheck principal. Devuelve 200 si todos los componentes están up,
   * 503 si alguno está down (Coolify / Docker healthcheck pueden reaccionar).
   * Marcado @Public() para no requerir JWT cuando AuthModule entre.
   */
  @Public()
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Health check del servicio',
    description:
      'Verifica que el backend está vivo y conectado a sus dependencias (Postgres). ' +
      'Devuelve 503 si algún componente está down.',
  })
  @ApiResponse({
    status: 200,
    description: 'Servicio up. Todos los componentes responden.',
    type: HealthResponseDto,
  })
  @ApiResponse({
    status: 503,
    description: 'Servicio degradado. Al menos un componente está down.',
    type: HealthResponseDto,
  })
  async check(@Res({ passthrough: true }) res: Response): Promise<HealthResponseDto> {
    const report = await this.health.check()
    if (report.status !== 'up') {
      res.status(HttpStatus.SERVICE_UNAVAILABLE)
    }
    return report
  }
}
