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

  /** Fuerza un refresh (se usa también tras un 401 de la API). */
  async refresh(clientId: string): Promise<{ accessToken: string; realmId: string }> {
    const row = await this.requireRow(clientId)
    if (row.refreshTokenExpiresAt.getTime() <= Date.now()) {
      throw new IntuitRefreshExpiredError(clientId)
    }
    const refreshToken = this.encryption.decrypt(row.refreshTokenEncrypted)
    const raw = await this.requestBearer(
      new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }),
    )
    await this.save(clientId, row.realmId, raw)
    return { accessToken: raw.access_token, realmId: row.realmId }
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

  /** Estado de conexión por cliente (sin exponer los tokens). */
  async listStatus(): Promise<
    {
      clientId: string
      realmId: string
      accessTokenExpiresAt: Date
      refreshTokenExpiresAt: Date
      refreshExpired: boolean
    }[]
  > {
    const rows = await this.repo.listAll()
    const now = Date.now()
    return rows.map((r) => ({
      clientId: r.clientId,
      realmId: r.realmId,
      accessTokenExpiresAt: r.accessTokenExpiresAt,
      refreshTokenExpiresAt: r.refreshTokenExpiresAt,
      refreshExpired: r.refreshTokenExpiresAt.getTime() <= now,
    }))
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
