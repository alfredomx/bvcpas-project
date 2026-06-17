import { Global, Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { AdminGuard } from './admin.guard'

/**
 * Auth slim del core. Registra `AdminGuard` como guard global (`APP_GUARD`):
 * toda ruta requiere token admin salvo las marcadas `@Public()`.
 *
 * También exporta `AdminGuard` para que un plugin lo aplique explícito con
 * `@UseGuards(AdminGuard)` si algún día se quita el global (cambio A→B: borrar
 * la línea APP_GUARD; el guard no cambia).
 */
@Global()
@Module({
  providers: [AdminGuard, { provide: APP_GUARD, useExisting: AdminGuard }],
  exports: [AdminGuard],
})
export class AuthModule {}
