import type { DomStep } from '../../23-plugin-bridge/bridge.types'
import type { BankFetchExecutor } from './bank-fetch.types'

/**
 * Contrato base de un adapter bancario (Design B). Cada banco implementa estas
 * **primitivas**: una operación de banco por método, **cero política**. La
 * orquestación (loops, rango, "latest", nombrado, cadencia) vive en mapi
 * (`BankDownloadService`), no aquí — D-mapi-BW-021.
 *
 * Fechas entran/salen en `MM-DD-YYYY` (formato público); cada adapter convierte
 * al formato interno del banco. El transporte es un `BankFetchExecutor`: el
 * adapter pide fetches, el plugin (kiro) los ejecuta en la sesión viva.
 */
export interface BankAccount {
  /** ID interno del banco. */
  id: string
  /** Últimos 4 dígitos. */
  mask: string
  /** Tipo genérico (ej. 'checking', 'credit'). */
  type: string
  /** Nombre descriptivo (opcional). */
  name?: string
}

/** Una transacción cruda listada por `searchTransactions` (sin imágenes). */
export interface BankTxn {
  sequenceNumber: string
  /** Fecha de posteo (YYYYMMDD, como la da el banco). */
  date: string
  amount?: number
  /** Número de cheque que da el banco en la actividad (puede faltar). */
  checkNumber?: string
}

/** Un item dentro del detalle de un depósito (los cheques que lo componen). */
export interface BankDepositItem {
  sequenceNumber: string
  /** Fecha de posteo del item (YYYYMMDD). */
  postDate?: string
  checkNumber?: string
  amount?: number
}

/** Detalle crudo de un depósito: si trae slip + los cheques que lo componen. */
export interface BankDepositDetails {
  depositSequenceNumber?: string
  totalDepositAmount?: number
  depositSlipAvailable?: boolean
  transactions?: BankDepositItem[]
}

/** Imagen cruda (front/rear en base64) de un cheque o slip. */
export interface BankImage {
  front?: string
  rear?: string
}

/** Referencia a un statement disponible (metadata, sin el PDF). */
export interface StatementRef {
  documentId: string
  /** YYYYMMDD. */
  date: string
}

/** Credenciales descifradas que recibe el adapter para armar la receta de login. */
export interface BankLoginCredentials {
  username: string
  password: string
  securityQa?: string | null
}

/**
 * Receta de login: la URL del logonbox a abrir + los pasos DOM (fill/click) que
 * kiro ejecuta a ciegas. La lógica (selectores) vive en el adapter (mapi); kiro
 * sigue tonto. La navegación a `url` la hace mapi con `open_tab`/`list_tabs`,
 * NO es un paso DOM (recargar mata el content script).
 */
export interface BankLoginRecipe {
  url: string
  steps: DomStep[]
}

/**
 * Receta de logout: `url` se usa SOLO para ubicar la pestaña del portal por host
 * (NO se navega — la pestaña ya está viva). `steps` son los pasos DOM (click en
 * "Sign out") que kiro ejecuta sobre esa pestaña. Tras el logout, mapi la cierra
 * con `close_tab`. La lógica (selectores) vive en el adapter; kiro sigue tonto.
 */
export interface BankLogoutRecipe {
  url: string
  steps: DomStep[]
}

export abstract class BankAdapter {
  protected constructor(protected readonly exec: BankFetchExecutor) {}

  /** Lista las cuentas del login. */
  abstract getAllAccounts(): Promise<BankAccount[]>

  /** Lista la actividad (CHECK/DEPOSIT) en el rango, sin descargar imágenes. */
  abstract searchTransactions(
    accountMask: string,
    dateFrom: string,
    dateTo: string,
    type: 'CHECK' | 'DEPOSIT',
  ): Promise<BankTxn[]>

  /** Detalle de un depósito (slip + cheques que lo componen). */
  abstract getDepositDetails(accountMask: string, deposit: BankTxn): Promise<BankDepositDetails>

  /** Descarga 1 imagen (front/rear) de un cheque o slip por su sequence number. */
  abstract downloadImage(
    accountMask: string,
    sequenceNumber: string,
    postDateYYYYMMDD: string,
    itemType: 'CHECK' | 'DEPOSIT_SLIP',
  ): Promise<BankImage>

  /**
   * Lista los statements disponibles (metadata, sin PDF). `yearsBack` controla
   * cuántos años hacia atrás mirar (default 1 = año actual + anterior). El filtro
   * por rango / "latest" lo decide mapi sobre esta lista.
   */
  abstract listStatements(
    accountMask: string,
    opts?: { yearsBack?: number },
  ): Promise<StatementRef[]>

  /** Descarga el PDF de 1 statement (docKey + csrf + pdf son internos). */
  abstract downloadStatementPdf(accountMask: string, ref: StatementRef): Promise<Buffer>

  /** Export de transacciones (CSV/QBO) como Buffer. */
  abstract exportTransactions(
    accountMask: string,
    dateFrom: string,
    dateTo: string,
    format: 'CSV' | 'QBO',
  ): Promise<Buffer>

  /**
   * Construye la receta de login (URL del logonbox + pasos DOM) con las
   * credenciales descifradas. Opcional: un banco cuyo login no esté automatizado
   * no la implementa → el caller lanza `BankLoginNotSupportedError`.
   */
  buildLoginRecipe?(creds: BankLoginCredentials): BankLoginRecipe

  /**
   * Construye la receta de logout (host del portal + pasos DOM para desloguear).
   * Opcional: un banco sin logout automatizado no la implementa → `endSession`
   * lo trata como no-op. Tras desloguear, mapi cierra la pestaña con `close_tab`.
   */
  buildLogoutRecipe?(): BankLogoutRecipe

  /** MM-DD-YYYY → YYYYMMDD (formato clásico de APIs financieras). */
  protected _formatDate(dateStr: string): string {
    const [m, d, y] = dateStr.split('-')
    return `${y}${m}${d}`
  }
}
