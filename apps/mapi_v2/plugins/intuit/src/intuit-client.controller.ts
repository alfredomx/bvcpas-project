import { Controller, Delete, Param, Post } from '@nestjs/common'
import { z } from 'zod'
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe'
import { IntuitOauthService } from './intuit-oauth.service'
import { IntuitTokensService } from './intuit-tokens.service'
import { IntuitTokensNotFoundError } from './intuit.errors'

const uuidPipe = new ZodValidationPipe(z.string().uuid())

/**
 * Gestión de la conexión QBO de un cliente concreto (bajo `AdminGuard`):
 * - `reconnect`: re-OAuth del cliente. Reutiliza el flujo client-first; el
 *   callback exige que la compañía autorizada sea la misma ya ligada
 *   (`INTUIT_REALM_MISMATCH`). Para cambiar de compañía: desconectar primero.
 * - `disconnect`: borra los tokens del cliente (revoca la conexión).
 */
@Controller('intuit/clients')
export class IntuitClientController {
  constructor(
    private readonly oauth: IntuitOauthService,
    private readonly tokens: IntuitTokensService,
  ) {}

  @Post(':clientId/reconnect')
  reconnect(@Param('clientId', uuidPipe) clientId: string): Promise<{ authorizeUrl: string }> {
    return this.oauth.connect(clientId)
  }

  @Delete(':clientId/connection')
  async disconnect(@Param('clientId', uuidPipe) clientId: string): Promise<{ deleted: boolean }> {
    const deleted = await this.tokens.deleteByClientId(clientId)
    if (!deleted) throw new IntuitTokensNotFoundError(clientId)
    return { deleted }
  }
}
