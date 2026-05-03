import { createParamDecorator, type ExecutionContext } from '@nestjs/common'
import type { Request } from 'express'
import type { SessionContext } from '../sessions.service'

/**
 * Param decorator que extrae el usuario autenticado del request.
 * Inyectado por el JwtAuthGuard previo. Si el endpoint es @Public()
 * y NO hay user autenticado, retorna undefined.
 *
 * Uso:
 *   async logout(@CurrentUser() user: SessionContext) { ... }
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): SessionContext | undefined => {
    const req = ctx.switchToHttp().getRequest<Request & { user?: SessionContext }>()
    return req.user
  },
)
