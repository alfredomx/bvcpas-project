import { Global, Module } from '@nestjs/common'
import 'dotenv/config'
import { configSchema } from './config.schema'
import { AppConfigService } from './config.service'

/**
 * Valida `process.env` contra el schema Zod al arranque. Si la validación
 * falla, lanza Error con mensaje agrupando todas las violaciones, lo cual
 * provoca que `bootstrap()` falle antes de aceptar tráfico.
 */
function validateEnv(): AppConfigService {
  const result = configSchema.safeParse(process.env)
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n')
    throw new Error(`Configuración inválida:\n${issues}`)
  }
  return new AppConfigService(result.data)
}

@Global()
@Module({
  providers: [
    {
      provide: AppConfigService,
      useFactory: validateEnv,
    },
  ],
  exports: [AppConfigService],
})
export class AppConfigModule {}
