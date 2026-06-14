import { randomUUID } from 'node:crypto'
import { Logger } from '@nestjs/common'
import {
  BankAdapter,
  type BankAccount,
  type BankLoginCredentials,
  type BankLoginRecipe,
} from './bank-adapter.base'
import type { BankFetchExecutor, BankFetchRequest, FetchResult } from './bank-fetch.types'
import { BankAdapterError, BankFetchError, ChaseAccountNotFoundError } from '../bank-worker.errors'

/**
 * URL del logonbox de Chase como pestaña top-level. El form de login queda en el
 * documento (no en el iframe sandboxed), así que el fill+click corre directo.
 * El prefijo de pod (`secureNNea`) lo resuelve Chase desde el host canónico.
 * Validado en vivo 2026-06-14 (memoria `project_chase_login_automation`).
 */
const CHASE_LOGON_URL = 'https://secure.chase.com/web/auth/#/logon/logon/chaseOnline'

// ── Resultados específicos de Chase (portados del proyecto original) ─────────

export interface DownloadedImage {
  sequenceNumber: string
  type: 'CHECK' | 'DEPOSIT_SLIP'
  frontImageBase64?: string
  rearImageBase64?: string
  /** Número de cheque (para el nombre de archivo). Puede faltar. */
  checkNumber?: string
  /** Fecha de posteo del cheque (YYYYMMDD, como la da Chase). */
  postDate?: string
  /** Monto del cheque (negativo = retiro). */
  amount?: number
}

export interface DepositResult {
  depositSequenceNumber: string
  totalAmount: number
  depositSlipImage?: DownloadedImage
  checksImages: DownloadedImage[]
}

export interface StatementResult {
  documentId: string
  date: string
  /** PDF en base64 (Design B: el plugin devuelve binario como base64). */
  pdfBase64: string
}

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
 * Adapter de Chase portado del proyecto original a Design B.
 *
 * Mecánica IDÉNTICA al original (endpoints, CSRF lifecycle, paginación) — solo
 * cambia el transporte: en vez de `page.request.fetch` (Playwright) usa un
 * `BankFetchExecutor` que despacha cada fetch al plugin vía el bridge.
 *
 * NOTA (el moat): el CSRF token se pide a `/svc/rl/.../csrf/token/list` y viaja
 * en la URL/body (`csrftoken=`), NUNCA en el header (header siempre
 * `x-jpmc-csrf-token: NONE`).
 */
export class ChaseAdapter extends BankAdapter {
  private readonly logger = new Logger(ChaseAdapter.name)
  private readonly baseUrl = 'https://secure.chase.com'

  constructor(exec: BankFetchExecutor) {
    super(exec)
  }

  /**
   * Receta de login de Chase (validada en vivo 2026-06-14, D-kiro-B13). mapi abre
   * `url` con open_tab/list_tabs y manda los `steps` por execute_dom; el `fill` de
   * kiro usa el native setter + eventos input/change (React no registra un
   * `value=x` pelón). Los datos post-login (cuentas/cheques) van por fetch.
   */
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
  ): Promise<ChaseTxn[]> {
    const accountInfo = await this._getAccountInfoByMask(accountMask)
    const dLow = this._formatDate(dateFrom)
    const dHigh = this._formatDate(dateTo)
    return this._searchActivityRecursively(accountInfo.id, dLow, dHigh, type)
  }

  async downloadChecks(
    accountMask: string,
    dateFrom: string,
    dateTo: string,
  ): Promise<DownloadedImage[]> {
    const accountInfo = await this._getAccountInfoByMask(accountMask)
    const txns = await this.searchTransactions(accountMask, dateFrom, dateTo, 'CHECK')

    const downloaded: DownloadedImage[] = []
    for (let i = 0; i < txns.length; i++) {
      const tx = txns[i]
      if (tx?.sequenceNumber) {
        const image = await this._downloadImage(accountInfo.id, tx.sequenceNumber, tx.date, 'CHECK')
        downloaded.push({
          sequenceNumber: tx.sequenceNumber,
          type: 'CHECK',
          frontImageBase64: image.checkFrontImage,
          rearImageBase64: image.checkRearImage,
          checkNumber: tx.checkNumber,
          postDate: tx.date,
          amount: tx.amount,
        })
        if (i < txns.length - 1) await delay(300)
      }
    }
    return downloaded
  }

  async downloadDeposits(
    accountMask: string,
    dateFrom: string,
    dateTo: string,
  ): Promise<DepositResult[]> {
    const accountInfo = await this._getAccountInfoByMask(accountMask)
    const deps = await this.searchTransactions(accountMask, dateFrom, dateTo, 'DEPOSIT')

    const results: DepositResult[] = []
    for (let depIdx = 0; depIdx < deps.length; depIdx++) {
      const dep = deps[depIdx]
      const details = await this._getDepositDetails(
        accountInfo.id,
        (dep.amount ?? '').toString(),
        dep.sequenceNumber,
        dep.date,
      )

      const depositResult: DepositResult = {
        depositSequenceNumber: details.depositSequenceNumber ?? dep.sequenceNumber,
        totalAmount: details.totalDepositAmount ?? dep.amount ?? 0,
        checksImages: [],
      }

      if (details.depositSlipAvailable) {
        const slipImg = await this._downloadImage(
          accountInfo.id,
          depositResult.depositSequenceNumber,
          dep.date,
          'DEPOSIT_SLIP',
        )
        depositResult.depositSlipImage = {
          sequenceNumber: depositResult.depositSequenceNumber,
          type: 'DEPOSIT_SLIP',
          frontImageBase64: slipImg.checkFrontImage,
          rearImageBase64: slipImg.checkRearImage,
          checkNumber: dep.checkNumber,
          postDate: dep.date,
          amount: depositResult.totalAmount,
        }
        await delay(300)
      }

      if (details.transactions && details.transactions.length > 0) {
        for (let checkIdx = 0; checkIdx < details.transactions.length; checkIdx++) {
          const checkTx = details.transactions[checkIdx]
          const checkImg = await this._downloadImage(
            accountInfo.id,
            checkTx.sequenceNumber,
            checkTx.postDate ?? dep.date,
            'CHECK',
          )
          depositResult.checksImages.push({
            sequenceNumber: checkTx.sequenceNumber,
            type: 'CHECK',
            frontImageBase64: checkImg.checkFrontImage,
            rearImageBase64: checkImg.checkRearImage,
            checkNumber: checkTx.checkNumber,
            postDate: checkTx.postDate ?? dep.date,
            amount: checkTx.amount,
          })
          if (checkIdx < details.transactions.length - 1) await delay(300)
        }
      }

      results.push(depositResult)
      if (depIdx < deps.length - 1) await delay(300)
    }
    return results
  }

  /** Devuelve el archivo (CSV/QBO) como Buffer. El controller decide cómo serializarlo. */
  async downloadTransactions(
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

  /** Descarga statements (PDF) en el rango [year/month .. mes actual]. */
  async downloadStatements(
    accountMask: string,
    year: string,
    month: string,
  ): Promise<StatementResult[]> {
    const accountInfo = await this._getAccountInfoByMask(accountMask)
    const yearFrom = parseInt(year, 10)
    const monthFrom = parseInt(month, 10)

    const now = new Date()
    const yearTo = now.getFullYear()
    const monthTo = now.getMonth() + 1

    const results: StatementResult[] = []
    const targetDateLow = new Date(yearFrom, monthFrom - 1, 1)
    const targetDateHigh = new Date(yearTo, monthTo, 0)

    for (let y = yearFrom; y <= yearTo; y++) {
      const currentYear = new Date().getFullYear()
      const diff = currentYear - y
      let yearFilter = 'CURRENT_YEAR'
      if (diff > 0) {
        if (diff > 10) continue // Chase soporta 10 años atrás
        yearFilter = `CURRENT_YEAR_MINUS_${diff}`
      }

      const allStatements = await this._getStatementList(accountInfo.id, yearFilter)

      for (const stmt of allStatements) {
        const dateStr = stmt.documentDate
        const sYear = parseInt(dateStr.substring(0, 4), 10)
        const sMonth = parseInt(dateStr.substring(4, 6), 10)
        const sDay = parseInt(dateStr.substring(6, 8), 10)
        const stmtDate = new Date(sYear, sMonth - 1, sDay)

        if (stmtDate >= targetDateLow && stmtDate <= targetDateHigh) {
          const docKeyData = await this._getStatementDocKey(
            accountInfo.id,
            stmt.documentId,
            yearFilter,
          )
          const freshCsrfToken = await this._getCsrfToken()
          const pdfBuffer = await this._downloadPdf(docKeyData.docKey, freshCsrfToken)
          results.push({
            documentId: stmt.documentId,
            date: stmt.documentDate,
            pdfBase64: pdfBuffer.toString('base64'),
          })
        }
      }
    }
    return results
  }

  // ── Privados (core + endpoints) ────────────────────────────────────────────

  /** Helper JSON: arma headers x-jpmc, hace el fetch vía executor, parsea JSON. */
  private async _request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`
    const headers: Record<string, string> = {
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
    accumulated: ChaseTxn[] = [],
  ): Promise<ChaseTxn[]> {
    const payload = new URLSearchParams({
      accountId,
      transactionType: type === 'CHECK' ? 'CHECK_WITHDRAWS' : 'DEPOSITS',
      dateHi: dateHigh,
      dateLo: dateLow,
    })
    if (currentPageId) payload.append('pageId', currentPageId)

    const response = await this._request<{ result?: ChaseTxn[]; nextPageId?: string }>(
      '/svc/rr/accounts/secure/v1/account/activity/dda/list',
      { method: 'POST', headers: { 'content-type': FORM }, body: payload.toString() },
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

  private async _getDepositDetails(
    accountId: string,
    amount: string,
    sequenceNumber: string,
    dateYYYYMMDD: string,
  ): Promise<ChaseDepositDetails> {
    const payload = new URLSearchParams({ accountId, amount, sequenceNumber, date: dateYYYYMMDD })
    return this._request<ChaseDepositDetails>(
      '/svc/rr/accounts/secure/v1/account/activity/detail/deposit/list',
      { method: 'POST', headers: { 'content-type': FORM }, body: payload.toString() },
    )
  }

  private async _downloadImage(
    accountId: string,
    sequenceNumber: string,
    dateYYYYMMDD: string,
    itemType: 'CHECK' | 'DEPOSIT_SLIP',
  ): Promise<ChaseImageResponse> {
    const queryParams = new URLSearchParams({
      'digital-account-identifier': accountId,
      'sequence-number': sequenceNumber,
      'transaction-posted-date': dateYYYYMMDD,
      'item-type-name': itemType,
    })
    const response = await this._request<ChaseImageResponse>(
      `/svc/rr/accounts/secure/gateway/deposit-account/transactions/inquiry-maintenance/digital-checks/v1/images?${queryParams.toString()}`,
      { method: 'GET' },
    )
    if (!response.checkFrontImage) {
      throw new BankAdapterError(`Sin imagen para ${itemType} ${sequenceNumber} en ${dateYYYYMMDD}`)
    }
    return response
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
}

interface ChaseMenuItem {
  accountId: number | string
  accountMask: string
  summaryType?: string
  nickname?: string
}

interface ChaseTxn {
  sequenceNumber: string
  date: string
  amount?: number
  /** Número de cheque que da Chase en la actividad (puede faltar). */
  checkNumber?: string
}

/** Item dentro del detalle de un depósito (los cheques que lo componen). */
interface ChaseDepositItem {
  sequenceNumber: string
  /** Fecha de posteo del item (YYYYMMDD). En el detalle viene como `postDate`. */
  postDate?: string
  checkNumber?: string
  amount?: number
}

interface ChaseDepositDetails {
  depositSequenceNumber?: string
  totalDepositAmount?: number
  depositSlipAvailable?: boolean
  transactions?: ChaseDepositItem[]
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

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
