import { Injectable } from '@nestjs/common'
import { IntuitApiService } from './intuit-api.service'
import { IntuitTokensService } from './intuit-tokens.service'

/** Paginación opcional de una lista (Query API de QBO). */
export interface ListOptions {
  startPosition?: number
  maxResults?: number
}

const MAX_PAGE = 1000

/**
 * Lecturas tipadas de QBO (read-through, GET-only). Construye sobre
 * `IntuitApiService.call` (refresh transparente): arma el `SELECT`/path/report
 * y devuelve el dato ya desempaquetado del envoltorio de QBO.
 *
 * GET-only por diseño: este servicio NO escribe en QBO. Las mutaciones
 * (POST/PATCH/DELETE) se agregan después, una por una, cuando se necesiten.
 */
@Injectable()
export class IntuitReadService {
  constructor(
    private readonly api: IntuitApiService,
    private readonly tokens: IntuitTokensService,
  ) {}

  /** Lista una entidad vía Query API. Devuelve el arreglo (vacío si no hay). */
  async list<T = unknown>(clientId: string, entity: string, opts: ListOptions = {}): Promise<T[]> {
    const { realmId } = await this.tokens.getValidAccessToken(clientId)
    const max = Math.min(Math.max(opts.maxResults ?? MAX_PAGE, 1), MAX_PAGE)
    const start = Math.max(opts.startPosition ?? 1, 1)
    const query = `SELECT * FROM ${entity} STARTPOSITION ${start} MAXRESULTS ${max}`
    const path = `/company/${realmId}/query?query=${encodeURIComponent(query)}`
    const data = (await this.api.call(clientId, 'GET', path)) as {
      QueryResponse?: Record<string, T[]>
    }
    return data.QueryResponse?.[entity] ?? []
  }

  /** Lee una entidad puntual por su `Id` de QBO. */
  async getById<T = unknown>(clientId: string, entity: string, id: string): Promise<T> {
    const { realmId } = await this.tokens.getValidAccessToken(clientId)
    const data = (await this.api.call(
      clientId,
      'GET',
      `/company/${realmId}/${entity.toLowerCase()}/${encodeURIComponent(id)}`,
    )) as Record<string, T>
    return (data[entity] ?? data) as T
  }

  /** Corre un Report de QBO; reenvía los query params recibidos como args. */
  async report(
    clientId: string,
    reportName: string,
    args: Record<string, string> = {},
  ): Promise<unknown> {
    const { realmId } = await this.tokens.getValidAccessToken(clientId)
    const qs = new URLSearchParams(args).toString()
    const path = `/company/${realmId}/reports/${reportName}${qs ? `?${qs}` : ''}`
    return this.api.call(clientId, 'GET', path)
  }

  /**
   * ExchangeRate no es queryable: GET dedicado con `sourcecurrencycode`
   * (requiere multimoneda habilitada en la compañía).
   */
  async exchangeRate(clientId: string, args: Record<string, string> = {}): Promise<unknown> {
    const { realmId } = await this.tokens.getValidAccessToken(clientId)
    const qs = new URLSearchParams(args).toString()
    return this.api.call(clientId, 'GET', `/company/${realmId}/exchangerate${qs ? `?${qs}` : ''}`)
  }
}
