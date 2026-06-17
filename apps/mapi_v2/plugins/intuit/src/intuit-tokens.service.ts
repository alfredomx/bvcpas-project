import { Injectable } from '@nestjs/common'
import { EncryptionService } from '@/core/encryption/encryption.service'
import { IntuitConfigService } from './intuit.config'
import { IntuitTokensRepository } from './intuit-tokens.repository'
import {
  IntuitAuthError,
  IntuitRefreshExpiredError,
  IntuitTokensNotFoundError,
} from './intuit.errors'
import type { IntuitTokens } from './intuit-tokens.schema'

/** Respuesta del token endpoint de Intuit. */
export interface IntuitBearerResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  x_refresh_token_expires_in: number
}

/** Refresca si el access vence dentro de este margen (segundos). */
const EXPIRY_SKEW_MS = 60_000
const MS_PER_DAY = 24 * 60 * 60 * 1000
/** Umbral para marcar `expiring_soon` en el estado de conexión. */
const EXPIRING_SOON_DAYS = 14

/** Estado de salud de una conexión QBO (para dashboard). */
export interface IntuitTokenStatus {
  clientId: string
  realmId: string
  accessTokenExpiresAt: Date
  refreshTokenExpiresAt: Date
  daysUntilRefreshExpiry: number
  refreshExpired: boolean
  needsReauth: boolean
  status: 'ok' | 'expiring_soon' | 'needs_reauth'
}

/**
 * Maneja los tokens QBO de un cliente: cifra/descifra (con el `EncryptionService`
 * del core), persiste, y refresca de forma transparente. No hace HTTP a la API
 * de QBO (eso es `IntuitApiService`); aquí solo el token endpoint de OAuth.
 */
@Injectable()
export class IntuitTokensService {
  constructor(
    private readonly repo: IntuitTokensRepository,
    private readonly encryption: EncryptionService,
    private readonly config: IntuitConfigService,
  ) {}

  /** Guarda (upsert) tokens cifrados + sus expiraciones, para un client+realm. */
  async save(clientId: string, realmId: string, raw: IntuitBearerResponse): Promise<void> {
    const now = Date.now()
    await this.repo.upsert({
      clientId,
      realmId,
      accessTokenEncrypted: this.encryption.encrypt(raw.access_token),
      refreshTokenEncrypted: this.encryption.encrypt(raw.refresh_token),
      accessTokenExpiresAt: new Date(now + raw.expires_in * 1000),
      refreshTokenExpiresAt: new Date(now + raw.x_refresh_token_expires_in * 1000),
    })
  }

  /** Access token válido (refresca si está por vencer) + el realm del cliente. */
  async getValidAccessToken(clientId: string): Promise<{ accessToken: string; realmId: string }> {
    const row = await this.requireRow(clientId)
    if (row.accessTokenExpiresAt.getTime() - EXPIRY_SKEW_MS > Date.now()) {
      return {
        accessToken: this.encryption.decrypt(row.accessTokenEncrypted),
        realmId: row.realmId,
      }
    }
    return this.refresh(clientId)
  }

  /**
   * Fuerza un refresh (se usa también tras un 401 de la API). Si falla porque el
   * refresh venció o Intuit lo rechaza, marca `needs_reauth=true` antes de lanzar.
   * Un refresh exitoso limpia el flag (vía `save`).
   */
  async refresh(clientId: string): Promise<{ accessToken: string; realmId: string }> {
    const row = await this.requireRow(clientId)
    if (row.refreshTokenExpiresAt.getTime() <= Date.now()) {
      await this.repo.setNeedsReauth(clientId, true)
      throw new IntuitRefreshExpiredError(clientId)
    }
    const refreshToken = this.encryption.decrypt(row.refreshTokenEncrypted)
    let raw: IntuitBearerResponse
    try {
      raw = await this.requestBearer(
        new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }),
      )
    } catch (err) {
      if (err instanceof IntuitAuthError) await this.repo.setNeedsReauth(clientId, true)
      throw err
    }
    await this.save(clientId, row.realmId, raw)
    return { accessToken: raw.access_token, realmId: row.realmId }
  }

  /**
   * Refresca TODAS las conexiones (lo corre el cron para mantenerlas vivas).
   * Cada fallo deja la conexión marcada `needs_reauth` (vía `refresh`). No lanza:
   * devuelve el conteo para loguear.
   */
  async refreshAll(): Promise<{ total: number; refreshed: number; failed: number }> {
    const rows = await this.repo.listAll()
    let refreshed = 0
    let failed = 0
    for (const r of rows) {
      try {
        await this.refresh(r.clientId)
        refreshed++
      } catch {
        failed++ // refresh() ya marcó needs_reauth
      }
    }
    return { total: rows.length, refreshed, failed }
  }

  /** Intercambia el `code` del callback por tokens y los guarda (grant inicial). */
  async exchangeCode(clientId: string, realmId: string, code: string): Promise<void> {
    const raw = await this.requestBearer(
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: this.config.redirectUri,
      }),
    )
    await this.save(clientId, realmId, raw)
  }

  /** Resuelve el `client_id` dueño de un realm (para el proxy por realmId). */
  async getClientIdByRealm(realmId: string): Promise<string> {
    const row = await this.repo.findByRealmId(realmId)
    if (!row) throw new IntuitTokensNotFoundError(realmId)
    return row.clientId
  }

  /** Estado de salud de cada conexión (sin exponer tokens) — para dashboard. */
  async listStatus(): Promise<IntuitTokenStatus[]> {
    const rows = await this.repo.listAll()
    const now = Date.now()
    return rows.map((r) => {
      const daysUntilRefreshExpiry = Math.floor(
        (r.refreshTokenExpiresAt.getTime() - now) / MS_PER_DAY,
      )
      const refreshExpired = r.refreshTokenExpiresAt.getTime() <= now
      const status: IntuitTokenStatus['status'] =
        r.needsReauth || refreshExpired
          ? 'needs_reauth'
          : daysUntilRefreshExpiry < EXPIRING_SOON_DAYS
            ? 'expiring_soon'
            : 'ok'
      return {
        clientId: r.clientId,
        realmId: r.realmId,
        accessTokenExpiresAt: r.accessTokenExpiresAt,
        refreshTokenExpiresAt: r.refreshTokenExpiresAt,
        daysUntilRefreshExpiry,
        refreshExpired,
        needsReauth: r.needsReauth,
        status,
      }
    })
  }

  deleteByClientId(clientId: string): Promise<boolean> {
    return this.repo.deleteByClientId(clientId)
  }

  private async requireRow(clientId: string): Promise<IntuitTokens> {
    const row = await this.repo.findByClientId(clientId)
    if (!row) throw new IntuitTokensNotFoundError(clientId)
    return row
  }

  /** POST al token endpoint de Intuit (Basic auth con client_id:client_secret). */
  private async requestBearer(form: URLSearchParams): Promise<IntuitBearerResponse> {
    const basic = Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString(
      'base64',
    )
    const res = await fetch(this.config.oauthTokenUrl, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: form.toString(),
    })
    if (!res.ok) {
      const body = await res.text()
      throw new IntuitAuthError(`Intuit token endpoint respondió ${res.status}`, { body })
    }
    return (await res.json()) as IntuitBearerResponse
  }
}
