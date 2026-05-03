import { Injectable, Logger } from '@nestjs/common'
import { AppConfigService } from '../../../core/config/config.service'
import { MetricsService } from '../../../core/metrics/metrics.service'
import { IntuitBadRequestError } from '../intuit-oauth.errors'
import { IntuitTokensService } from '../tokens/intuit-tokens.service'

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'

export interface ApiCallParams {
  clientId: string
  method: HttpMethod
  path: string
  body?: unknown
}

const PROD_BASE = 'https://quickbooks.api.intuit.com/v3'

/**
 * Proxy HTTP genérico contra Intuit Developer V3 API.
 *
 * - `getValidTokens` antes de cada call (refresh transparente si falta).
 * - Retry-on-401: si Intuit responde 401 (token revocado server-side antes
 *   de expirar), forceRefresh y reintenta UNA vez. Sin retry exponencial
 *   ni rate limiting; cuando entre posting con volumen real, agregar.
 * - Path normalizado para métricas: realmIds y otros IDs numéricos se
 *   reemplazan a `:realm` / `:id` para no inflar la cardinalidad de
 *   Prometheus.
 */
@Injectable()
export class IntuitApiService {
  private readonly logger = new Logger(IntuitApiService.name)

  constructor(
    private readonly tokens: IntuitTokensService,
    private readonly cfg: AppConfigService,
    private readonly metrics: MetricsService,
  ) {}

  async call<T = unknown>(params: ApiCallParams): Promise<T> {
    const token = await this.tokens.getValidTokens(params.clientId)
    return this.execute<T>(token.accessToken, params, false)
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
          const fresh = await this.tokens.forceRefresh(params.clientId)
          return this.execute<T>(fresh.accessToken, params, true)
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
