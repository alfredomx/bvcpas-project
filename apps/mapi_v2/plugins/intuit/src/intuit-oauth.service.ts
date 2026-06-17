import { randomBytes } from 'node:crypto'
import { Inject, Injectable } from '@nestjs/common'
import type Redis from 'ioredis'
import { REDIS_CLIENT } from '@/core/redis/redis.module'
import { ClientsService } from '@/modules/11-clients/clients.service'
import { IntuitConfigService } from './intuit.config'
import { IntuitTokensService } from './intuit-tokens.service'
import { IntuitTokensRepository } from './intuit-tokens.repository'
import { IntuitRealmConflictError, IntuitStateInvalidError } from './intuit.errors'

const STATE_PREFIX = 'intuit:oauth:state:'
const STATE_TTL_SECONDS = 600
const SCOPE = 'com.intuit.quickbooks.accounting openid'

/**
 * Orquesta el OAuth client-first de Intuit:
 * - `connect`: valida el client (del core), guarda un state en Redis y arma la URL.
 * - `callback`: valida el state, checa conflicto de realm, intercambia el code y
 *   guarda los tokens. No crea el client (ya existe) ni sobreescribe su info.
 */
@Injectable()
export class IntuitOauthService {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly config: IntuitConfigService,
    private readonly clients: ClientsService,
    private readonly tokens: IntuitTokensService,
    private readonly tokensRepo: IntuitTokensRepository,
  ) {}

  async connect(clientId: string): Promise<{ authorizeUrl: string }> {
    await this.clients.getById(clientId) // 404 (ClientNotFound) si no existe
    const state = randomBytes(24).toString('hex')
    await this.redis.set(`${STATE_PREFIX}${state}`, clientId, 'EX', STATE_TTL_SECONDS)

    const url = new URL(this.config.authorizeUrl)
    url.searchParams.set('client_id', this.config.clientId)
    url.searchParams.set('redirect_uri', this.config.redirectUri)
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('scope', SCOPE)
    url.searchParams.set('state', state)
    return { authorizeUrl: url.toString() }
  }

  async callback(
    code: string,
    realmId: string,
    state: string,
  ): Promise<{ clientId: string; realmId: string }> {
    const key = `${STATE_PREFIX}${state}`
    const clientId = await this.redis.get(key)
    if (!clientId) throw new IntuitStateInvalidError()
    await this.redis.del(key)

    const existing = await this.tokensRepo.findByRealmId(realmId)
    if (existing && existing.clientId !== clientId) {
      throw new IntuitRealmConflictError(realmId)
    }

    await this.tokens.exchangeCode(clientId, realmId, code)
    return { clientId, realmId }
  }
}
