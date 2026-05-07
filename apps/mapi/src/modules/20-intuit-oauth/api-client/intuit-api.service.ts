import { Injectable, Logger } from '@nestjs/common'
import { AppConfigService } from '../../../core/config/config.service'
import { MetricsService } from '../../../core/metrics/metrics.service'
import { ConnectionTokenRefreshService } from '../../21-connections/connection-token-refresh.service'
import { IntuitBadRequestError } from '../intuit-oauth.errors'

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'

export interface ApiCallParams {
  clientId: string
  /** Usuario que dispara la llamada. Necesario para resolver
   * read (personal-prefer-global) vs write (personal-required). */
  userId: string
  method: HttpMethod
  path: string
  body?: unknown
}

const PROD_BASE = 'https://quickbooks.api.intuit.com/v3'

/**
 * Proxy HTTP genérico contra Intuit Developer V3 API.
 *
 * v0.8.0: ahora consume `ConnectionTokenRefreshService` en vez del viejo
 * `IntuitTokensService`. Para GET (lectura) usa la conexión read-priority
 * (personal del user; fallback a readonly global). Para POST/PUT/DELETE
 * (escritura) requiere conexión personal full del user — si no existe,
 * lanza IntuitPersonalConnectionRequiredError (HTTP 403).
 *
 * Retry-on-401: si Intuit responde 401 (token revocado server-side antes
 * de expirar), refrescamos vía connection y reintentamos UNA vez. El
 * refresh on-demand <5min ya está cubierto por
 * `ConnectionTokenRefreshService`; el retry-on-401 cubre el caso edge
 * de revocación remota.
 *
 * Path normalizado para métricas: realmIds y otros IDs numéricos se
 * reemplazan a `:realm` / `:id` para no inflar la cardinalidad de
 * Prometheus.
 */
@Injectable()
export class IntuitApiService {
  private readonly logger = new Logger(IntuitApiService.name)

  constructor(
    private readonly tokens: ConnectionTokenRefreshService,
    private readonly cfg: AppConfigService,
    private readonly metrics: MetricsService,
  ) {}

  async call<T = unknown>(params: ApiCallParams): Promise<T> {
    const accessToken = await this.resolveToken(params)
    return this.execute<T>(accessToken, params, false)
  }

  private async resolveToken(params: ApiCallParams): Promise<string> {
    if (params.method === 'GET') {
      return this.tokens.getValidAccessTokenForClientRead('intuit', params.clientId, params.userId)
    }
    return this.tokens.getValidAccessTokenForClientWrite('intuit', params.clientId, params.userId)
  }

  private async execute<T>(
    accessToken: string,
    params: ApiCallParams,
    isRetry: boolean,
  ): Promise<T> {
    const labelPath = this.normalizePathForMetrics(params.path)
    let status = 'unknown'

    try {
      const result = await this.fetchOnce<T>(accessToken, params)
      status = '200'
      return result
    } catch (err) {
      if (err instanceof IntuitBadRequestError) {
        const fault = err.details?.qboErrors as { status?: number } | undefined
        status = fault?.status ? String(fault.status) : 'error'

        if (!isRetry && fault?.status === 401) {
          this.logger.warn(`Got 401 from Intuit for client ${params.clientId}, force refreshing`)
          // El refresh on-demand del refresh service no aplica si el access
          // está vigente pero revocado server-side. En ese caso la única
          // opción es refrescar igualmente y reintentar. El refresh service
          // refresca cuando msUntilExpiry <= REFRESH_BUFFER_MS, que aquí no
          // se cumple. Forzamos resolveToken otra vez tras un pequeño
          // sleep no aplica; en su lugar, re-resolvemos: si Intuit revocó
          // el access, también revocó el refresh, y el refresh fallará con
          // invalid_grant elevando IntuitRefreshTokenExpiredError.
          // Nota: en v0.8.x si esto se vuelve frecuente, agregar
          // forceRefresh helper en ConnectionTokenRefreshService.
          const fresh = await this.resolveToken(params)
          return this.execute<T>(fresh, params, true)
        }
      } else {
        status = 'error'
      }
      throw err
    } finally {
      this.metrics.intuitApiCallsTotal.inc({ path: labelPath, status })
    }
  }

  private async fetchOnce<T>(accessToken: string, params: ApiCallParams): Promise<T> {
    const minorVersion = this.cfg.intuitMinorVersion
    const separator = params.path.includes('?') ? '&' : '?'
    const url = `${PROD_BASE}${params.path}${separator}minorversion=${minorVersion}`

    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    }
    if (params.body !== undefined) headers['Content-Type'] = 'application/json'

    const init: RequestInit = {
      method: params.method,
      headers,
      ...(params.body !== undefined ? { body: JSON.stringify(params.body) } : {}),
    }

    const res = await fetch(url, init)
    if (res.ok) {
      return (await res.json()) as T
    }
    const errBody = await res.text()
    throw new IntuitBadRequestError(`Intuit API ${res.status}: ${errBody.substring(0, 500)}`, {
      status: res.status,
      body: errBody,
    })
  }

  /**
   * Reemplaza realmIds (≥6 dígitos) y otros IDs numéricos para acotar la
   * cardinalidad del label `path` en Prometheus.
   */
  private normalizePathForMetrics(path: string): string {
    const withoutQuery = path.split('?')[0] ?? path
    return withoutQuery.replace(/\/\d{6,}/g, '/:realm').replace(/\/\d+/g, '/:id')
  }
}
