import { SetMetadata } from '@nestjs/common'

/**
 * Marca un endpoint como público (sin requerir JWT). Cuando AuthModule entre,
 * el JwtAuthGuard leerá esta metadata para skipear la verificación.
 *
 * Uso: `@Public() @Get('healthz')`
 */
export const IS_PUBLIC_KEY = 'isPublic'
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true)
