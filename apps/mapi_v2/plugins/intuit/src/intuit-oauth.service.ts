import { randomBytes } from 'node:crypto'
import { Inject, Injectable } from '@nestjs/common'
import type Redis from 'ioredis'
import { REDIS_CLIENT } from '@/core/redis/redis.module'
import { ClientsService } from '@/modules/11-clients/clients.service'
import { IntuitConfigService } from './intuit.config'
import { IntuitTokensService } from './intuit-tokens.service'
import { IntuitTokensRepository } from './intuit-tokens.repository'
import {
  IntuitRealmConflictError,
  IntuitRealmMismatchError,
  IntuitStateInvalidError,
} from './intuit.errors'

const STATE_PREFIX = 'intuit:oauth:state:'
const STATE_TTL_SECONDS = 600
const SCOPE = 'com.intuit.quickbooks.accounting openid'

/** Lo que guardamos en Redis bajo el state (qué cliente + anti-mixup de realm). */
interface OauthState {
  clientId: string
  /** Si el cliente ya está conectado, el realm esperado (reconnect = misma compañía). */
  expectedRealm?: string
}

/**
 * Orquesta el OAuth client-first de Intuit:
 * - `connect`: valida el client (del core), guarda un state en Redis y arma la URL.
 *   Si el cliente ya tenía conexión, recuerda su realm para exigir que el
 *   reconnect sea la misma compañía (anti-mixup).
 * - `callback`: valida el state, checa conflicto/mismatch de realm, intercambia
 *   el code y guarda los tokens. No crea el client ni sobreescribe su info.
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
    // Si ya está conectado, recordamos su realm: el reconnect debe ser la misma compañía.
    const existing = await this.tokensRepo.findByClientId(clientId)
    const payload: OauthState = { clientId, expectedRealm: existing?.realmId }
    const state = randomBytes(24).toString('hex')
    await this.redis.set(
      `${STATE_PREFIX}${state}`,
      JSON.stringify(payload),
      'EX',
      STATE_TTL_SECONDS,
    )

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
    const raw = await this.redis.get(key)
    if (!raw) throw new IntuitStateInvalidError()
    await this.redis.del(key)
    const { clientId, expectedRealm } = JSON.parse(raw) as OauthState

    // Anti-mixup en reconnect: la compañía autorizada debe ser la ya ligada.
    if (expectedRealm && realmId !== expectedRealm) {
      throw new IntuitRealmMismatchError(expectedRealm, realmId)
    }
    // El realm no puede estar ligado a OTRO cliente.
    const existing = await this.tokensRepo.findByRealmId(realmId)
    if (existing && existing.clientId !== clientId) {
      throw new IntuitRealmConflictError(realmId)
    }

    await this.tokens.exchangeCode(clientId, realmId, code)
    return { clientId, realmId }
  }
}
