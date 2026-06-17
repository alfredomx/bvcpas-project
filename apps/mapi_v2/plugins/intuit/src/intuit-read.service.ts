import { Injectable } from '@nestjs/common'
import { IntuitApiService } from './intuit-api.service'
import { IntuitTokensService } from './intuit-tokens.service'
import { IntuitTooManyRecordsError } from './intuit.errors'

/** Paginación opcional de una lista (Query API de QBO). */
export interface ListOptions {
  startPosition?: number
  maxResults?: number
}

/** Máximo por página que acepta la Query API de QBO. */
const PAGE_SIZE = 1000
/** Tope de seguridad del auto-paginado: 20 páginas = 20 000 registros. */
const MAX_PAGES = 20

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

  /**
   * Lista una entidad vía Query API.
   *
   * - **Sin** `startPosition`/`maxResults`: auto-pagina (loop de páginas de 1000)
   *   y devuelve TODOS los registros. Tope de seguridad `MAX_PAGES` (20 000): si
   *   se supera, lanza `INTUIT_TOO_MANY_RECORDS` (no trunca en silencio).
   * - **Con** alguno de los dos: una sola página (override manual para la UI).
   */
  async list<T = unknown>(clientId: string, entity: string, opts: ListOptions = {}): Promise<T[]> {
    const { realmId } = await this.tokens.getValidAccessToken(clientId)

    // Override manual → una sola página, como pidió el caller.
    if (opts.startPosition !== undefined || opts.maxResults !== undefined) {
      const max = Math.min(Math.max(opts.maxResults ?? PAGE_SIZE, 1), PAGE_SIZE)
      const start = Math.max(opts.startPosition ?? 1, 1)
      return this.fetchPage<T>(clientId, realmId, entity, start, max)
    }

    // Auto-paginado: trae todo, con tope de seguridad.
    const all: T[] = []
    let start = 1
    for (let page = 0; page < MAX_PAGES; page++) {
      const rows = await this.fetchPage<T>(clientId, realmId, entity, start, PAGE_SIZE)
      all.push(...rows)
      if (rows.length < PAGE_SIZE) return all // última página → exhausto
      start += PAGE_SIZE
    }
    // Llegamos al tope con la última página llena → quedan más: no truncamos callado.
    throw new IntuitTooManyRecordsError(entity, MAX_PAGES * PAGE_SIZE)
  }

  private async fetchPage<T>(
    clientId: string,
    realmId: string,
    entity: string,
    start: number,
    max: number,
  ): Promise<T[]> {
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
