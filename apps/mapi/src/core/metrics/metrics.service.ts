import { Injectable } from '@nestjs/common'
import { collectDefaultMetrics, Registry } from 'prom-client'
import { AppConfigService } from '../config/config.service'

/**
 * Wrapper sobre prom-client Registry. Cada módulo que necesite métricas
 * propias inyecta este servicio y registra contra `registry`.
 *
 * En Fundación sólo expone las métricas default de Node (heap, GC, event
 * loop, CPU). No define contadores custom.
 */
@Injectable()
export class MetricsService {
  readonly registry: Registry

  constructor(cfg: AppConfigService) {
    this.registry = new Registry()
    this.registry.setDefaultLabels({ app: 'mapi', env: cfg.nodeEnv })
    collectDefaultMetrics({ register: this.registry })
  }

  metrics(): Promise<string> {
    return this.registry.metrics()
  }

  contentType(): string {
    return this.registry.contentType
  }
}
