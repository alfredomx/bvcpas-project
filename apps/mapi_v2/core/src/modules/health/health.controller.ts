import { Controller, Get } from '@nestjs/common'
import { HealthService, type HealthStatus } from './health.service'

@Controller('healthz')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get()
  check(): HealthStatus {
    return this.health.check()
  }
}
