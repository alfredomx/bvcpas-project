import { randomBytes } from 'node:crypto'
import { Inject, Injectable, Logger } from '@nestjs/common'
import type Redis from 'ioredis'
import { AppConfigService } from '../../../core/config/config.service'
import { REDIS_CLIENT } from '../../../core/auth/redis.module'
import { EventLogService } from '../../95-event-log/event-log.service'
import { ClientsRepository, type CreateClientData } from '../../11-clients/clients.repository'
import { ConnectionsService } from '../../21-connections/connections.service'
import { IntuitOauthClientFactory } from '../intuit-oauth-client.factory'
import { IntuitAuthorizationError, IntuitStateInvalidError } from '../intuit-oauth.errors'

const STATE_TTL_SECONDS = 600
const STATE_PREFIX = 'oauth:state:'
const PROD_BASE = 'https://quickbooks.api.intuit.com/v3'

type OauthPurpose = 'new-client' | 'reauth'

interface OauthStatePayload {
  user_id: string
  client_id: string | null
  purpose: OauthPurpose
  created_at: string
}

interface IntuitTokenResponse {
  token: {
    access_token: string
    refresh_token: string
    expires_in: number
    x_refresh_token_expires_in: number
  }
}

interface IntuitCompanyInfo {
  Id: string
  CompanyName: string
  LegalName?: string
  Country?: string
  FiscalYearStartMonth?: string
  Email?: { Address?: string }
  PrimaryPhone?: { FreeFormNumber?: string }
  WebAddr?: { URI?: string }
  CompanyStartDate?: string
  LegalAddr?: Record<string, unknown>
  CompanyAddr?: Record<string, unknown>
  NameValue?: { Name: string; Value: string }[]
}

const FISCAL_MONTHS: Record<string, number> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
}

export type CallbackOutcome = 'created' | 'reauth-silent' | 'reauth-target'

export interface CallbackResult {
  client_id: string
  realm_id: string
  company_name: string
  outcome: CallbackOutcome
}

/**
 * Orquestador del flow OAuth de Intuit.
 *
 * - `getAuthorizationUrlForNewClient`: link inicial para conectar QBO sin
 *   cliente existente. State guarda purpose='new-client'.
 * - `getAuthorizationUrl`: link para re-conectar a un cliente target ya
 *   existente. State guarda purpose='reauth' + client_id.
 * - `handleCallback`: recibe code+realmId+state, valida state en Redis,
 *   intercambia code por tokens, fetcha CompanyInfo, decide CREATE vs
 *   silent re-auth vs reauth-target según purpose, persiste tokens
 *   cifrados, emite evento, borra state.
 *
 * State vive en Redis con TTL 600s. Si el usuario tarda >10min en aprobar
 * en Intuit, el link expira (CSRF mitigation + UX limpio).
 */
@Injectable()
export class IntuitOauthService {
  private readonly logger = new Logger(IntuitOauthService.name)

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly connections: ConnectionsService,
    private readonly clientsRepo: ClientsRepository,
    private readonly oauthClientFactory: IntuitOauthClientFactory,
    private readonly cfg: AppConfigService,
    private readonly events: EventLogService,
  ) {}

  async getAuthorizationUrlForNewClient(userId: string): Promise<string> {
    return this.buildAuthorizationUrl({
      user_id: userId,
      client_id: null,
      purpose: 'new-client',
      created_at: new Date().toISOString(),
    })
  }

  async getAuthorizationUrl(userId: string, clientId: string): Promise<string> {
    return this.buildAuthorizationUrl({
      user_id: userId,
      client_id: clientId,
      purpose: 'reauth',
      created_at: new Date().toISOString(),
    })
  }

  async handleCallback(
    _code: string,
    realmId: string,
    state: string,
    fullUrl: string,
  ): Promise<CallbackResult> {
    const stateKey = `${STATE_PREFIX}${state}`
    const rawPayload = await this.redis.get(stateKey)
    if (!rawPayload) throw new IntuitStateInvalidError()

    const payload = JSON.parse(rawPayload) as OauthStatePayload

    const tokenResponse = await this.exchangeCode(fullUrl)
    const { access_token, refresh_token, expires_in, x_refresh_token_expires_in } =
      tokenResponse.token

    const now = new Date()
    const accessTokenExpiresAt = new Date(now.getTime() + expires_in * 1000)
    const refreshTokenExpiresAt = new Date(now.getTime() + x_refresh_token_expires_in * 1000)

    const companyInfo = await this.fetchCompanyInfo(realmId, access_token)
    const companyName = companyInfo?.LegalName ?? companyInfo?.CompanyName ?? 'Unknown'

    let resolvedClientId: string
    let outcome: CallbackOutcome
    let eventType: string

    if (payload.purpose === 'new-client') {
      const existing = await this.clientsRepo.findByRealmId(realmId)
      if (existing) {
        if (existing.legalName !== companyName && companyName !== 'Unknown') {
          await this.clientsRepo.update(existing.id, { legalName: companyName })
        }
        resolvedClientId = existing.id
        outcome = 'reauth-silent'
        eventType = 'intuit.client.reauth_silent'
      } else {
        const createData = companyInfo
          ? this.mapCompanyInfoToClient(companyInfo, realmId)
          : { legalName: companyName, qboRealmId: realmId }
        const created = await this.clientsRepo.create(createData)
        resolvedClientId = created.id
        outcome = 'created'
        eventType = 'intuit.client.created'
      }
    } else {
      if (!payload.client_id) {
        throw new IntuitAuthorizationError('flow reauth requiere client_id en state')
      }
      const existingByRealm = await this.clientsRepo.findByRealmId(realmId)
      if (existingByRealm && existingByRealm.id !== payload.client_id) {
        throw new IntuitAuthorizationError(`Realm ${realmId} ya está registrado para otro cliente`)
      }
      const targetClient = await this.clientsRepo.findById(payload.client_id)
      if (!targetClient) {
        throw new IntuitAuthorizationError(`Cliente ${payload.client_id} ya no existe`)
      }
      await this.clientsRepo.update(payload.client_id, {
        qboRealmId: realmId,
        legalName: companyName,
      })
      resolvedClientId = payload.client_id
      outcome = 'reauth-target'
      eventType = 'intuit.client.reauth_target'
    }

    // v0.8.0: persiste en user_connections (provider='intuit') vía
    // ConnectionsService. Reemplaza el viejo IntuitTokensRepository.upsert.
    // user_id es el operador que está haciendo el OAuth. scope_type='full'
    // por default — la cuenta global readonly se conecta aparte por
    // customer-service@bv-cpas.com con scope_type='readonly' después.
    await this.connections.upsert({
      userId: payload.user_id,
      provider: 'intuit',
      externalAccountId: realmId,
      clientId: resolvedClientId,
      scopeType: 'full',
      email: null,
      label: null,
      scopes: 'com.intuit.quickbooks.accounting openid',
      accessToken: access_token,
      refreshToken: refresh_token,
      accessTokenExpiresAt,
      refreshTokenExpiresAt,
    })

    await this.redis.del(stateKey)

    await this.events.log(
      eventType,
      { realm_id: realmId, outcome, company_name: companyName },
      payload.user_id,
      { type: 'client', id: resolvedClientId },
    )

    return {
      client_id: resolvedClientId,
      realm_id: realmId,
      company_name: companyName,
      outcome,
    }
  }

  private async buildAuthorizationUrl(payload: OauthStatePayload): Promise<string> {
    const state = randomBytes(24).toString('hex')
    await this.redis.set(
      `${STATE_PREFIX}${state}`,
      JSON.stringify(payload),
      'EX',
      STATE_TTL_SECONDS,
    )

    const oauthClient = this.oauthClientFactory.create()
    return oauthClient.authorizeUri({
      scope: ['com.intuit.quickbooks.accounting', 'openid'],
      state,
    })
  }

  private async exchangeCode(fullUrl: string): Promise<IntuitTokenResponse> {
    const oauthClient = this.oauthClientFactory.create()
    try {
      return await oauthClient.createToken(fullUrl)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      this.logger.error(`Intuit createToken failed: ${msg}`)
      throw new IntuitAuthorizationError(`No se pudo intercambiar code por tokens: ${msg}`)
    }
  }

  private async fetchCompanyInfo(
    realmId: string,
    accessToken: string,
  ): Promise<IntuitCompanyInfo | null> {
    const url = `${PROD_BASE}/company/${realmId}/companyinfo/${realmId}?minorversion=${this.cfg.intuitMinorVersion}`
    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
      })
      if (!res.ok) {
        this.logger.warn(`fetchCompanyInfo ${realmId} ${res.status}`)
        return null
      }
      const body = (await res.json()) as { CompanyInfo: IntuitCompanyInfo }
      return body.CompanyInfo
    } catch (err) {
      this.logger.warn(
        `fetchCompanyInfo ${realmId} failed: ${err instanceof Error ? err.message : String(err)}`,
      )
      return null
    }
  }

  private mapCompanyInfoToClient(ci: IntuitCompanyInfo, realmId: string): CreateClientData {
    const legalName = ci.LegalName ?? ci.CompanyName ?? 'Unknown'
    const dba = ci.CompanyName && ci.CompanyName !== legalName ? ci.CompanyName : null

    const fiscalYearStart = ci.FiscalYearStartMonth
      ? (FISCAL_MONTHS[ci.FiscalYearStartMonth.toLowerCase()] ?? null)
      : null

    const metadata: Record<string, unknown> = {}
    if (ci.Country) metadata.intuit_country = ci.Country
    if (ci.LegalAddr) metadata.intuit_address = ci.LegalAddr
    else if (ci.CompanyAddr) metadata.intuit_address = ci.CompanyAddr
    if (ci.PrimaryPhone?.FreeFormNumber) metadata.intuit_phone = ci.PrimaryPhone.FreeFormNumber
    if (ci.WebAddr?.URI) metadata.intuit_website = ci.WebAddr.URI
    if (ci.CompanyStartDate) metadata.intuit_company_start_date = ci.CompanyStartDate
    if (ci.NameValue && ci.NameValue.length > 0) metadata.intuit_namevalue = ci.NameValue

    return {
      legalName,
      dba,
      qboRealmId: realmId,
      fiscalYearStart,
      primaryContactEmail: ci.Email?.Address ?? null,
      metadata: Object.keys(metadata).length > 0 ? metadata : null,
    }
  }
}
