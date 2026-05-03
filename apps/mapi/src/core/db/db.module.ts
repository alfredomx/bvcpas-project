import {
  Global,
  Inject,
  Injectable,
  Logger,
  Module,
  type OnApplicationShutdown,
} from '@nestjs/common'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres, { type Sql } from 'postgres'
import { AppConfigModule } from '../config/config.module'
import { AppConfigService } from '../config/config.service'

/**
 * Tokens DI para el cliente postgres-js (raw) y la instancia drizzle.
 *
 * Convención:
 * - DB_CLIENT: cliente postgres-js (sólo para shutdown / queries raw).
 * - DB: instancia drizzle (uso normal en repositorios).
 */
export const DB = Symbol('DB')
export const DB_CLIENT = Symbol('DB_CLIENT')

export type DrizzleDb = ReturnType<typeof drizzle>

/**
 * Lifecycle helper: cierra el pool de Postgres con timeout de 5s al shutdown
 * de la app. Sin esto, los containers tardan más en parar y dejan conexiones
 * colgando en el server.
 */
@Injectable()
class DbLifecycle implements OnApplicationShutdown {
  private readonly logger = new Logger(DbLifecycle.name)

  constructor(@Inject(DB_CLIENT) private readonly client: Sql) {}

  async onApplicationShutdown(): Promise<void> {
    this.logger.log('Closing Postgres pool...')
    await this.client.end({ timeout: 5 })
    this.logger.log('Postgres pool closed')
  }
}

@Global()
@Module({
  imports: [AppConfigModule],
  providers: [
    {
      provide: DB_CLIENT,
      inject: [AppConfigService],
      useFactory: (cfg: AppConfigService): Sql =>
        postgres(cfg.databaseUrl, {
          max: 10,
          idle_timeout: 20,
          connect_timeout: 10,
        }),
    },
    {
      provide: DB,
      inject: [DB_CLIENT],
      useFactory: (client: Sql): DrizzleDb => drizzle(client),
    },
    DbLifecycle,
  ],
  exports: [DB, DB_CLIENT],
})
export class DbModule {}
