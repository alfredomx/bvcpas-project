/**
 * Tipos de **resultado ensamblado** de la descarga. El adapter devuelve
 * primitivas crudas (`BankTxn`, `BankImage`, `BankDepositDetails`, `Buffer`); el
 * `BankDownloadService` arma estos shapes a partir de ellas.
 */

/** Una imagen descargada y lista para guardar (cheque o slip). */
export interface DownloadedImage {
  sequenceNumber: string
  type: 'CHECK' | 'DEPOSIT_SLIP'
  frontImageBase64?: string
  rearImageBase64?: string
  /** Número de cheque (para el nombre de archivo). Puede faltar. */
  checkNumber?: string
  /** Fecha de posteo (YYYYMMDD). */
  postDate?: string
  /** Monto (negativo = retiro). */
  amount?: number
}

/** Un depósito ensamblado: el slip + los cheques que lo componen. */
export interface DepositResult {
  depositSequenceNumber: string
  totalAmount: number
  depositSlipImage?: DownloadedImage
  checksImages: DownloadedImage[]
}

/** Un statement descargado (PDF en base64). */
export interface StatementResult {
  documentId: string
  /** YYYYMMDD. */
  date: string
  pdfBase64?: string
}

/** Progreso de una descarga (objeto, para verlo en bancos lentos). */
export interface DownloadProgress {
  stage: 'checks' | 'deposits' | 'statements' | 'transactions'
  account: string
  accountIndex: number
  accountTotal: number
  done: number
  total: number
}

/** Callback opcional de progreso (el worker lo conecta a `job.updateProgress`). */
export type ProgressFn = (p: DownloadProgress) => void | Promise<void>
