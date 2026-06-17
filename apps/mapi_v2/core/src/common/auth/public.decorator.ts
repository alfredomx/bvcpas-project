import { SetMetadata } from '@nestjs/common'

/**
 * Marca una ruta como pública: el `AdminGuard` global la deja pasar sin token.
 *
 * Default del core: TODO requiere token admin. `@Public()` es la excepción —
 * úsalo solo en lo externo (liveness, callbacks OAuth de un plugin, webhooks).
 *
 * Uso: `@Public() @Get('healthz')`
 */
export const IS_PUBLIC_KEY = 'isPublic'
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true)
