import {
  Global,
  Inject,
  Injectable,
  Logger,
  Module,
  type OnApplicationShutdown,
} from '@nestjs/common'
import Redis from 'ioredis'
import { AppConfigModule } from '@/core/config/config.module'
import { AppConfigService } from '@/core/config/config.service'

/**
 * Token DI para el cliente Redis raw (ioredis).
 *
 * Es independiente de las conexiones que BullMQ abre por su cuenta: este
 * cliente sirve para health check, locks y cache. Las colas (QueueModule)
 * gestionan sus propias conexiones a partir de la misma REDIS_URL.
 */
export const REDIS_CLIENT = Symbol('REDIS_CLIENT')

/**
 * Lifecycle helper: cierra la conexión Redis al shutdown, en línea con cómo
 * DbModule cierra el pool de Postgres. Sin esto el proceso tarda más en parar.
 */
@Injectable()
class RedisLifecycle implements OnApplicationShutdown {
  private readonly logger = new Logger(RedisLifecycle.name)

  constructor(@Inject(REDIS_CLIENT) private readonly client: Redis) {}

  async onApplicationShutdown(): Promise<void> {
    this.logger.log('Closing Redis connection...')
    await this.client.quit()
    this.logger.log('Redis connection closed')
  }
}

@Global()
@Module({
  imports: [AppConfigModule],
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [AppConfigService],
      useFactory: (cfg: AppConfigService): Redis =>
        new Redis(cfg.redisUrl, {
          maxRetriesPerRequest: null,
          enableReadyCheck: true,
        }),
    },
    RedisLifecycle,
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
