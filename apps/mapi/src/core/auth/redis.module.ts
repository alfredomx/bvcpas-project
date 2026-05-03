import { Global, Module } from '@nestjs/common'
import Redis from 'ioredis'
import { AppConfigModule } from '../config/config.module'
import { AppConfigService } from '../config/config.service'

/**
 * Token DI para el cliente Redis raw.
 */
export const REDIS_CLIENT = Symbol('REDIS_CLIENT')

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
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
