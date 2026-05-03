import { Controller, Get, Header, Res } from '@nestjs/common'
import { ApiExcludeController } from '@nestjs/swagger'
import type { Response } from 'express'
import { Public } from '../../common/decorators/public.decorator'
import { MetricsService } from './metrics.service'

/**
 * Endpoint Prometheus en /metrics (sin prefijo /v1, convención mundial).
 * Excluido de OpenAPI/Scalar — es para scraping de Prometheus, no para
 * humanos vía docs.
 */
@ApiExcludeController()
@Controller({ path: 'metrics', version: undefined })
export class MetricsController {
  constructor(private readonly metricsSvc: MetricsService) {}

  @Public()
  @Get()
  @Header('Cache-Control', 'no-store')
  async metrics(@Res({ passthrough: true }) res: Response): Promise<string> {
    res.setHeader('Content-Type', this.metricsSvc.contentType())
    return this.metricsSvc.metrics()
  }
}
