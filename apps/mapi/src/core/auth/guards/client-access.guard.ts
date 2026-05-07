import { CanActivate, ExecutionContext, Injectable, SetMetadata } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { Request } from 'express'
import { ClientNotFoundError } from '../../../modules/11-clients/clients.errors'
import { ClientAccessRepository } from '../../../modules/11-clients/client-access.repository'
import type { SessionContext } from '../sessions.service'

export const CLIENT_ID_PARAM_KEY = 'clientIdParam'

/**
 * Decorador para indicar de qué `:param` del path leer el clientId.
 *
 * Default: `id` (consistente con `/v1/clients/:id`). Para rutas que
 * usan otro nombre (ej. `:clientId`), aplicar:
 *   @ClientIdParam('clientId')
 */
export const ClientIdParam = (param: string): MethodDecorator =>
  SetMetadata(CLIENT_ID_PARAM_KEY, param)

/**
 * Guard que valida que el usuario actual tiene acceso al cliente
 * referenciado en el path.
 *
 * Aplica a todo controller con `:id` o `:clientId` del cliente. Lee de
 * `user_client_access` y, si no hay match, lanza
 * `ClientNotFoundError` (HTTP 404). NUNCA 403 — D-mapi-024: no
 * leakeamos existencia.
 *
 * Si el path no contiene un param de cliente identificable, el guard
 * pasa (no aplica). Esto permite usarlo a nivel @Controller() sin
 * necesidad de excluir explícitamente endpoints que no operan sobre
 * un cliente específico.
 *
 * Performance: una query SELECT 1 con índice de PK compuesta
 * (user_id, client_id). Aceptable para path crítico.
 */
@Injectable()
export class ClientAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly accessRepo: ClientAccessRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request & { user?: SessionContext }>()
    const user = req.user
    if (!user) {
      // Si llega aquí sin user, JwtAuthGuard ya falló o el endpoint es
      // @Public(). Para @Public no hay user; el guard no debería
      // bloquear esos casos.
      return true
    }

    const paramName =
      this.reflector.getAllAndOverride<string>(CLIENT_ID_PARAM_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? 'id'

    const clientId = req.params[paramName]
    if (!clientId || typeof clientId !== 'string') {
      // El handler no expone un :id de cliente — el guard no aplica.
      return true
    }

    const has = await this.accessRepo.hasAccess(user.userId, clientId)
    if (!has) {
      // D-mapi-024: 404 (no 403) para no leakear si el cliente existe.
      throw new ClientNotFoundError(clientId)
    }

    return true
  }
}
