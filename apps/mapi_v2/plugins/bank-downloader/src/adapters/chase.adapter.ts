import { randomUUID } from 'node:crypto'
import { Logger } from '@nestjs/common'
import {
  BankAdapter,
  type BankAccount,
  type BankDepositDetails,
  type BankImage,
  type BankLoginCredentials,
  type BankLoginRecipe,
  type BankLogoutRecipe,
  type BankTxn,
  type StatementRef,
} from './bank-adapter.base'
import type { BankFetchExecutor, BankFetchRequest, FetchResult } from './bank-fetch.types'
import {
  BankAdapterError,
  BankFetchError,
  ChaseAccountNotFoundError,
} from '../bank-download.errors'

/**
 * URL del logonbox de Chase como pestaña top-level. El form de login queda en el
 * documento (no en el iframe sandboxed), así que el fill+click corre directo.
 * Validado en vivo 2026-06-14 (memoria `project_chase_login_automation`).
 */
const CHASE_LOGON_URL = 'https://secure.chase.com/web/auth/#/logon/logon/chaseOnline'

/** Cuántos años atrás soporta Chase en el filtro de statements. */
const CHASE_MAX_YEARS_BACK = 10

interface StatementDocKeyResponse {
  docURI?: string
  docKey: string
}

interface ChaseAccountInfo {
  id: string
  mask: string
  type: 'dda' | 'vls'
}

/**
 * Adapter de Chase (Design B) — **primitivas crudas**. Una operación de banco
 * por método, cero política. La orquestación (loops, rango, "latest", nombrado,
 * cadencia) vive en `BankDownloadService`.
 *
 * El moat: CSRF token a `/svc/rl/.../csrf/token/list`, viaja en URL/body
 * (`csrftoken=`), NUNCA en header (header siempre `x-jpmc-csrf-token: NONE`).
 */
export class ChaseAdapter extends BankAdapter {
  private readonly logger = new Logger(ChaseAdapter.name)
  private readonly baseUrl = 'https://secure.chase.com'

  constructor(exec: BankFetchExecutor) {
    super(exec)
  }

  buildLoginRecipe(creds: BankLoginCredentials): BankLoginRecipe {
    return {
      url: CHASE_LOGON_URL,
      steps: [
        { op: 'waitFor', selector: '#userId-input-field-input' },
        { op: 'fill', selector: '#userId-input-field-input', value: creds.username },
        { op: 'fill', selector: '#password-input-field-input', value: creds.password },
        { op: 'click', selector: '#signin-button' },
      ],
    }
  }

  /**
   * Receta de logout: click en el botón "Sign out" de la barra superior. El `url`
   * es solo el host del portal para que mapi ubique la pestaña viva (no navega).
   * Selector validado en vivo 2026-06-14 (id `#brand_bar_sign_in_out`).
   */
  buildLogoutRecipe(): BankLogoutRecipe {
    return {
      url: CHASE_LOGON_URL,
      steps: [
        { op: 'waitFor', selector: '#brand_bar_sign_in_out' },
        { op: 'click', selector: '#brand_bar_sign_in_out' },
      ],
    }
  }

  async getAllAccounts(): Promise<BankAccount[]> {
    const response = await this._request<{ items?: ChaseMenuItem[] }>(
      '/svc/rr/documents/secure/v1/menu/list',
      { method: 'POST', headers: { 'content-type': FORM }, body: '' },
    )
    if (!response?.items) return []
    return response.items.map((acc) => ({
      id: acc.accountId?.toString() ?? '',
      mask: acc.accountMask,
      type: acc.summaryType === 'DDA' ? 'checking' : 'credit',
      name: acc.nickname ?? '',
    }))
  }

  async searchTransactions(
    accountMask: string,
    dateFrom: string,
    dateTo: string,
    type: 'CHECK' | 'DEPOSIT',
  ): Promise<BankTxn[]> {
    const accountInfo = await this._getAccountInfoByMask(accountMask)
    const dLow = this._formatDate(dateFrom)
    const dHigh = this._formatDate(dateTo)
    return this._searchActivityRecursively(accountInfo.id, dLow, dHigh, type)
  }

  async getDepositDetails(accountMask: string, deposit: BankTxn): Promise<BankDepositDetails> {
    const accountInfo = await this._getAccountInfoByMask(accountMask)
    const payload = new URLSearchParams({
      accountId: accountInfo.id,
      amount: (deposit.amount ?? '').toString(),
      sequenceNumber: deposit.sequenceNumber,
      date: deposit.date,
    })
    return this._request<BankDepositDetails>(
      '/svc/rr/accounts/secure/v1/account/activity/detail/deposit/list',
      {
        method: 'POST',
        minimal: true,
        headers: { 'content-type': FORM },
        body: payload.toString(),
      },
    )
  }

  async downloadImage(
    accountMask: string,
    sequenceNumber: string,
    postDateYYYYMMDD: string,
    itemType: 'CHECK' | 'DEPOSIT_SLIP',
  ): Promise<BankImage> {
    const accountInfo = await this._getAccountInfoByMask(accountMask)
    const queryParams = new URLSearchParams({
      'digital-account-identifier': accountInfo.id,
      'sequence-number': sequenceNumber,
      'transaction-posted-date': postDateYYYYMMDD,
      'item-type-name': itemType,
    })
    const response = await this._request<ChaseImageResponse>(
      `/svc/rr/accounts/secure/gateway/deposit-account/transactions/inquiry-maintenance/digital-checks/v1/images?${queryParams.toString()}`,
      { method: 'GET', minimal: true, headers: { 'content-type': FORM } },
    )
    if (!response.checkFrontImage) {
      throw new BankAdapterError(
        `Sin imagen para ${itemType} ${sequenceNumber} en ${postDateYYYYMMDD}`,
      )
    }
    return { front: response.checkFrontImage, rear: response.checkRearImage }
  }

  async listStatements(
    accountMask: string,
    opts: { yearsBack?: number } = {},
  ): Promise<StatementRef[]> {
    const accountInfo = await this._getAccountInfoByMask(accountMask)
    const yearsBack = Math.min(opts.yearsBack ?? 1, CHASE_MAX_YEARS_BACK)

    const refs: StatementRef[] = []
    for (let diff = 0; diff <= yearsBack; diff++) {
      const yearFilter = diff === 0 ? 'CURRENT_YEAR' : `CURRENT_YEAR_MINUS_${diff}`
      const statements = await this._getStatementList(accountInfo.id, yearFilter)
      for (const stmt of statements) {
        refs.push({ documentId: stmt.documentId, date: stmt.documentDate })
      }
    }
    return refs
  }

  async downloadStatementPdf(accountMask: string, ref: StatementRef): Promise<Buffer> {
    const accountInfo = await this._getAccountInfoByMask(accountMask)
    const yearFilter = this._yearFilterForDate(ref.date)
    const docKeyData = await this._getStatementDocKey(accountInfo.id, ref.documentId, yearFilter)
    const csrfToken = await this._getCsrfToken()
    return this._downloadPdf(docKeyData.docKey, csrfToken)
  }

  async exportTransactions(
    accountMask: string,
    dateFrom: string,
    dateTo: string,
    format: 'CSV' | 'QBO',
  ): Promise<Buffer> {
    const accountInfo = await this._getAccountInfoByMask(accountMask)
    const dLow = this._formatDate(dateFrom)
    const dHigh = this._formatDate(dateTo)
    return this._exportData(accountInfo, dLow, dHigh, format.toUpperCase())
  }

  // ── Privados (core + endpoints) ────────────────────────────────────────────

  /** YYYYMMDD → filtro de año de Chase (CURRENT_YEAR / CURRENT_YEAR_MINUS_N). */
  private _yearFilterForDate(dateYYYYMMDD: string): string {
    const sYear = parseInt(dateYYYYMMDD.substring(0, 4), 10)
    const diff = new Date().getFullYear() - sYear
    return diff <= 0 ? 'CURRENT_YEAR' : `CURRENT_YEAR_MINUS_${diff}`
  }

  /** Helper JSON: arma headers x-jpmc, hace el fetch vía executor, parsea JSON. */
  private async _request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`
    // `minimal`: solo los headers que manda bankify (x-jpmc-csrf-token + content-type).
    // Las llamadas de actividad (dda/list, deposit, images) lo usan: los headers
    // extra (accept, x-jpmc-channel, x-jpmc-client-request-id) disparan 403 ahí.
    const headers: Record<string, string> = options.minimal
      ? { 'x-jpmc-csrf-token': 'NONE', ...(options.headers ?? {}) }
      : {
          accept: 'application/json, text/plain, */*',
          'x-jpmc-csrf-token': 'NONE',
          'x-jpmc-channel': 'id=C30',
          'x-jpmc-client-request-id': randomUUID(),
          ...(options.headers ?? {}),
        }

    const result = await this.exec.fetch({
      method: options.method ?? 'POST',
      url,
      headers,
      body: options.body,
    })

    this._assertOk(result, url)
    try {
      return JSON.parse(result.body) as T
    } catch {
      throw new BankAdapterError(`Respuesta JSON inválida de ${endpoint}`)
    }
  }

  /** Genera un CSRF token fresco. Va en URL/body, NUNCA en header. */
  private async _getCsrfToken(): Promise<string> {
    const url = `${this.baseUrl}/svc/rl/accounts/secure/v1/csrf/token/list`
    const result = await this.exec.fetch({
      method: 'POST',
      url,
      headers: { 'x-jpmc-csrf-token': 'NONE', 'content-type': FORM },
    })
    this._assertOk(result, url)
    const data = JSON.parse(result.body) as { csrfToken: string }
    return data.csrfToken
  }

  private async _getAccountInfoByMask(mask: string): Promise<ChaseAccountInfo> {
    const response = await this._request<{ items?: ChaseMenuItem[] }>(
      '/svc/rr/documents/secure/v1/menu/list',
      { method: 'POST', headers: { 'content-type': FORM }, body: '' },
    )
    if (!response?.items) {
      throw new BankAdapterError('No se encontró items en menu/list')
    }
    const account = response.items.find((acc) => acc.accountMask === mask)
    if (!account) throw new ChaseAccountNotFoundError(mask)
    return {
      id: account.accountId.toString(),
      mask: account.accountMask,
      type: account.summaryType === 'DDA' ? 'dda' : 'vls',
    }
  }

  /** Paginador recursivo de actividad (CHECK/DEPOSIT). */
  private async _searchActivityRecursively(
    accountId: string,
    dateLow: string,
    dateHigh: string,
    type: 'CHECK' | 'DEPOSIT',
    currentPageId?: string,
    accumulated: BankTxn[] = [],
  ): Promise<BankTxn[]> {
    // Payload y headers idénticos a bankify (referencia que SÍ funciona):
    // {accountId, dateLo, dateHi, transactionType}, headers mínimos, SIN
    // csrftoken ni x-jpmc-channel/x-jpmc-client-request-id — esos disparan 403
    // en `accounts/secure/activity`.
    const payload = new URLSearchParams({
      accountId,
      dateLo: dateLow,
      dateHi: dateHigh,
      transactionType: type === 'CHECK' ? 'CHECK_WITHDRAWS' : 'DEPOSITS',
    })
    if (currentPageId) payload.append('pageId', currentPageId)

    const response = await this._request<{ result?: BankTxn[]; nextPageId?: string }>(
      '/svc/rr/accounts/secure/v1/account/activity/dda/list',
      {
        method: 'POST',
        minimal: true,
        headers: { 'content-type': FORM },
        body: payload.toString(),
      },
    )

    const current = response.result ?? []
    const newAccumulated = [...accumulated, ...current]
    const nextPage = response.nextPageId

    if (nextPage && current.length > 0) {
      return this._searchActivityRecursively(
        accountId,
        dateLow,
        dateHigh,
        type,
        nextPage,
        newAccumulated,
      )
    }
    return newAccumulated
  }

  private async _getStatementList(
    accountId: string,
    yearFilter: string,
  ): Promise<ChaseStatement[]> {
    const payload = new URLSearchParams({
      accountFilter: accountId,
      'dateFilter.idalDateFilterType': yearFilter,
    })
    const response = await this._request<{ idaldocRefs?: ChaseStatement[] }>(
      '/svc/rr/documents/secure/idal/v2/docref/list',
      { method: 'POST', headers: { 'content-type': FORM }, body: payload.toString() },
    )
    const statements = response.idaldocRefs
    if (!Array.isArray(statements)) {
      this.logger.warn(
        `Esperaba array de statements para ${yearFilter}, llegó ${typeof statements}`,
      )
      return []
    }
    return statements
  }

  private async _getStatementDocKey(
    accountId: string,
    documentId: string,
    yearFilter: string,
  ): Promise<StatementDocKeyResponse> {
    const payload = new URLSearchParams({
      accountFilter: accountId,
      'dateFilter.idalDateFilterType': yearFilter,
      documentId,
    })
    const response = await this._request<StatementDocKeyResponse>(
      '/svc/rr/documents/secure/idal/v2/dockey/list',
      { method: 'POST', headers: { 'content-type': FORM }, body: payload.toString() },
    )
    if (!response.docKey) {
      throw new BankAdapterError(`Sin docKey para el documento ${documentId}`)
    }
    return response
  }

  private async _downloadPdf(docKey: string, csrfToken: string): Promise<Buffer> {
    if (!docKey || !csrfToken) {
      throw new BankAdapterError('docKey y csrfToken son requeridos')
    }
    const url = `${this.baseUrl}/svc/rr/documents/secure/idal/v5/pdfdoc/star/list?docKey=${docKey}&download=true&adaVersion=false&csrftoken=${csrfToken}`
    const result = await this.exec.fetch({
      method: 'GET',
      url,
      headers: { 'x-jpmc-csrf-token': 'NONE', Accept: 'application/pdf' },
    })
    this._assertOk(result, url)
    const buf = bodyToBuffer(result)
    if (buf.length === 0) throw new BankAdapterError('PDF descargado vacío')
    return buf
  }

  private async _exportData(
    accountInfo: ChaseAccountInfo,
    dateLow: string,
    dateHigh: string,
    fileType: string,
  ): Promise<Buffer> {
    // 1. Count / validación previa (sin csrftoken).
    const countPayload = new URLSearchParams({
      dateHi: dateHigh,
      dateLo: dateLow,
      statementPeriodId: 'ALL',
      transactionType: 'ALL',
      filterTranType: 'ALL',
      downloadType: fileType,
      accountId: accountInfo.id,
      submit: 'Submit',
    })
    const countResponse = await this._request<ChaseCountResponse>(
      `/svc/rr/accounts/secure/v1/account/activity/download/count/${accountInfo.type}/list`,
      { method: 'POST', headers: { 'content-type': FORM }, body: countPayload.toString() },
    )
    const transactionCount =
      countResponse.ddaDownloadActivityCount ?? countResponse.vlsDownloadActivityCount
    if (transactionCount === undefined) {
      throw new BankAdapterError(
        `Count inválido: falta el conteo para tipo de cuenta ${accountInfo.type}`,
      )
    }
    if (transactionCount <= 0) {
      this.logger.warn(`Sin transacciones en el rango ${dateLow}..${dateHigh}`)
      return Buffer.alloc(0)
    }

    // 2. Descarga real — token fresco va en el body, NONE en el header.
    const exportCsrfToken = await this._getCsrfToken()
    const downloadPayload = new URLSearchParams({
      dateHi: dateHigh,
      dateLo: dateLow,
      statementPeriodId: 'ALL',
      transactionType: 'ALL',
      filterTranType: 'ALL',
      downloadType: fileType,
      accountId: accountInfo.id,
      csrftoken: exportCsrfToken,
      submit: 'Submit',
    })
    const url = `${this.baseUrl}/svc/rr/accounts/secure/v1/account/activity/download/${accountInfo.type}/list`
    const result = await this.exec.fetch({
      method: 'POST',
      url,
      headers: {
        accept: '*/*',
        'content-type': FORM,
        'x-jpmc-csrf-token': 'NONE',
        'x-jpmc-channel': 'id=C30',
        'x-jpmc-client-request-id': randomUUID(),
      },
      body: downloadPayload.toString(),
    })
    this._assertOk(result, url)
    const buf = bodyToBuffer(result)
    if (buf.length === 0) throw new BankAdapterError('Archivo descargado vacío')
    return buf
  }

  /** Lanza `BankFetchError` si el plugin reportó error de red o el banco devolvió no-2xx. */
  private _assertOk(result: FetchResult, url: string): void {
    if (result.error) throw new BankFetchError(`${url}: ${result.error}`)
    if (!result.ok) throw new BankFetchError(`${url}: HTTP ${result.status}`)
  }
}

// ── Tipos internos / helpers ─────────────────────────────────────────────────

const FORM = 'application/x-www-form-urlencoded; charset=UTF-8'

interface RequestOptions {
  method?: BankFetchRequest['method']
  headers?: Record<string, string>
  body?: string
  /** Solo headers mínimos (como bankify): sin accept/x-jpmc-channel/client-request-id. */
  minimal?: boolean
}

interface ChaseMenuItem {
  accountId: number | string
  accountMask: string
  summaryType?: string
  nickname?: string
}

interface ChaseImageResponse {
  checkFrontImage?: string
  checkRearImage?: string
}

interface ChaseStatement {
  documentId: string
  documentDate: string
}

interface ChaseCountResponse {
  ddaDownloadActivityCount?: number
  vlsDownloadActivityCount?: number
}

function bodyToBuffer(result: FetchResult): Buffer {
  return result.bodyEncoding === 'base64'
    ? Buffer.from(result.body, 'base64')
    : Buffer.from(result.body, 'utf8')
}
