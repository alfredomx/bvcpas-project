import { Controller, Get, HttpCode, HttpStatus, Res } from '@nestjs/common'
import type { Response } from 'express'
import { Public } from '../../common/decorators/public.decorator'
import { HealthService, type HealthReport } from './health.service'

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
  async check(@Res({ passthrough: true }) res: Response): Promise<HealthReport> {
    const report = await this.health.check()
    if (report.status !== 'up') {
      res.status(HttpStatus.SERVICE_UNAVAILABLE)
    }
    return report
  }
}
