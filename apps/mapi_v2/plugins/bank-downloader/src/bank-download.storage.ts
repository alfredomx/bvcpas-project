import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { PDFDocument } from 'pdf-lib'

/**
 * Guardado a disco de cheques/depósitos/statements — formato del operador.
 * Replica la lógica del plugin original (bankify):
 *  - 1 PDF por cheque con la imagen frontal.
 *  - Nombre: `MM-DD-YYYY - <checkNumber>.pdf` (depósitos agregan ` (<amount>)`).
 *
 * Estructura: `<baseDir>/<cliente>/<mask>/<archivo>.pdf`. El destino real (subir a
 * Dropbox por carpeta del cliente) sigue diferido al BACKLOG.
 */

export interface DownloadedCheckLike {
  sequenceNumber: string
  type: string
  checkNumber?: string
  postDate?: string
  amount?: number
  frontImageBase64?: string
  rearImageBase64?: string
}

export interface SavedAccountChecks {
  account_mask: string
  checks: DownloadedCheckLike[]
}

/** Carpeta base (relativa al cwd del server). NO es el destino final. */
export const DEMO_DOWNLOADS_DIR = '.downloads'

/** Detecta el formato de imagen por los magic bytes (png/jpg/...) para embeber el PDF. */
export function detectImageExtension(base64: string): string {
  const head = Buffer.from(base64.slice(0, 24), 'base64')
  if (head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47) return 'png'
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return 'jpg'
  if (head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46) return 'pdf'
  if (head[0] === 0x47 && head[1] === 0x49 && head[2] === 0x46) return 'gif'
  if (
    (head[0] === 0x49 && head[1] === 0x49 && head[2] === 0x2a) ||
    (head[0] === 0x4d && head[1] === 0x4d && head[2] === 0x00)
  ) {
    return 'tiff'
  }
  return 'bin'
}

/** Nombre de carpeta/archivo seguro para FS, legible (conserva letras/números). */
export function safeFolderName(name: string): string {
  const cleaned = name
    .replace(/[^\p{L}\p{N}.\- ]+/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
  return cleaned.length > 0 ? cleaned : 'sin-nombre'
}

/** YYYYMMDD → MM-DD-YYYY (como el plugin original). Fallback si no es válida. */
export function formatPostDate(postDate?: string): string {
  if (postDate && /^\d{8}$/.test(postDate)) {
    return `${postDate.slice(4, 6)}-${postDate.slice(6, 8)}-${postDate.slice(0, 4)}`
  }
  if (!postDate?.trim()) return 'sin-fecha'
  return safeFolderName(postDate)
}

/** Monto formateado en-US como bankify (`872.71`, `1,200`). */
export function formatAmount(amount: number): string {
  return amount.toLocaleString('en-US')
}

/**
 * Nombre del archivo de un cheque: `MM-DD-YYYY - <checkNumber>` (sin extensión).
 * Con `includeAmount` agrega ` (<amount>)` — para depósitos. Si el cheque no trae
 * `checkNumber`, usa `fallbackNumber` (contador por cuenta).
 */
export function buildCheckFileName(
  check: DownloadedCheckLike,
  fallbackNumber: number,
  opts: { includeAmount?: boolean } = {},
): string {
  const num = check.checkNumber?.trim() ? check.checkNumber : String(fallbackNumber)
  let name = `${formatPostDate(check.postDate)} - ${safeFolderName(num)}`
  if (opts.includeAmount && check.amount !== undefined && check.amount !== null) {
    name += ` (${formatAmount(check.amount)})`
  }
  return name
}

/** `YYYYMMDD` → `YYYY-MM` para el nombre del statement (como bankify). */
export function buildStatementFileName(documentDate: string): string {
  if (/^\d{8}$/.test(documentDate)) {
    return `${documentDate.slice(0, 4)}-${documentDate.slice(4, 6)}`
  }
  return safeFolderName(documentDate) || 'statement'
}

/** Convierte la imagen frontal (base64) a un PDF de una página del tamaño de la imagen. */
async function frontImageToPdf(base64: string): Promise<Uint8Array> {
  const bytes = Buffer.from(base64, 'base64')
  const pdf = await PDFDocument.create()
  const ext = detectImageExtension(base64)
  const img = ext === 'jpg' ? await pdf.embedJpg(bytes) : await pdf.embedPng(bytes)
  const page = pdf.addPage([img.width, img.height])
  page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height })
  return pdf.save()
}

/**
 * Escribe los cheques a `<baseDir>/<cliente>/<mask>/<MM-DD-YYYY - check>.pdf`
 * (un PDF por cheque, imagen frontal). Salta cuentas sin cheques.
 */
export async function saveChecksToDisk(opts: {
  baseDir: string
  clientName: string
  accounts: SavedAccountChecks[]
}): Promise<{ dir: string; filesWritten: number }> {
  const clientDir = join(opts.baseDir, safeFolderName(opts.clientName))
  let filesWritten = 0

  for (const acct of opts.accounts) {
    const withFront = acct.checks.filter((c) => c.frontImageBase64)
    if (withFront.length === 0) continue

    const acctDir = join(clientDir, safeFolderName(acct.account_mask))
    await mkdir(acctDir, { recursive: true })

    let fallbackNumber = 0
    for (const chk of acct.checks) {
      if (!chk.frontImageBase64) continue
      const usedFallback = !chk.checkNumber?.trim()
      const name = buildCheckFileName(chk, fallbackNumber)
      if (usedFallback) fallbackNumber++

      const pdfBytes = await frontImageToPdf(chk.frontImageBase64)
      await writeFile(join(acctDir, `${name}.pdf`), pdfBytes)
      filesWritten++
    }
  }

  return { dir: clientDir, filesWritten }
}

export interface DepositResultLike {
  depositSlipImage?: DownloadedCheckLike
  checksImages: DownloadedCheckLike[]
}

export interface SavedAccountDeposits {
  account_mask: string
  deposits: DepositResultLike[]
}

/**
 * Guarda depósitos: el slip + cada cheque del depósito como PDF, nombre
 * `MM-DD-YYYY - <checkNumber> (<amount>).pdf` (CON monto). El slip suele no traer
 * checkNumber → usa el contador por cuenta.
 */
export async function saveDepositsToDisk(opts: {
  baseDir: string
  clientName: string
  accounts: SavedAccountDeposits[]
}): Promise<{ dir: string; filesWritten: number }> {
  const clientDir = join(opts.baseDir, safeFolderName(opts.clientName))
  let filesWritten = 0

  for (const acct of opts.accounts) {
    const images: DownloadedCheckLike[] = []
    for (const dep of acct.deposits) {
      if (dep.depositSlipImage?.frontImageBase64) images.push(dep.depositSlipImage)
      for (const chk of dep.checksImages) if (chk.frontImageBase64) images.push(chk)
    }
    if (images.length === 0) continue

    const acctDir = join(clientDir, safeFolderName(acct.account_mask))
    await mkdir(acctDir, { recursive: true })

    let fallbackNumber = 0
    for (const img of images) {
      if (!img.frontImageBase64) continue
      const usedFallback = !img.checkNumber?.trim()
      const name = buildCheckFileName(img, fallbackNumber, { includeAmount: true })
      if (usedFallback) fallbackNumber++

      const pdfBytes = await frontImageToPdf(img.frontImageBase64)
      await writeFile(join(acctDir, `${name}.pdf`), pdfBytes)
      filesWritten++
    }
  }

  return { dir: clientDir, filesWritten }
}

export interface StatementLike {
  documentId: string
  /** YYYYMMDD. */
  date: string
  pdfBase64?: string
}

export interface SavedAccountStatements {
  account_mask: string
  statements: StatementLike[]
}

/** Guarda statements (ya son PDF) como `YYYY-MM.pdf`. Solo decodifica y escribe. */
export async function saveStatementsToDisk(opts: {
  baseDir: string
  clientName: string
  accounts: SavedAccountStatements[]
}): Promise<{ dir: string; filesWritten: number }> {
  const clientDir = join(opts.baseDir, safeFolderName(opts.clientName))
  let filesWritten = 0

  for (const acct of opts.accounts) {
    if (acct.statements.length === 0) continue
    const acctDir = join(clientDir, safeFolderName(acct.account_mask))
    await mkdir(acctDir, { recursive: true })

    for (const stmt of acct.statements) {
      if (!stmt.pdfBase64) continue
      const name = buildStatementFileName(stmt.date)
      await writeFile(join(acctDir, `${name}.pdf`), Buffer.from(stmt.pdfBase64, 'base64'))
      filesWritten++
    }
  }

  return { dir: clientDir, filesWritten }
}

/**
 * Guarda el export de transacciones (CSV/QBO) de una cuenta como
 * `<mask> (<from> to <to>).<csv|qbo>`. Devuelve la ruta del archivo.
 */
export async function saveTransactionFileToDisk(opts: {
  baseDir: string
  clientName: string
  accountMask: string
  from: string
  to: string
  format: 'CSV' | 'QBO'
  content: string
}): Promise<{ dir: string; file: string }> {
  const clientDir = join(opts.baseDir, safeFolderName(opts.clientName))
  const acctDir = join(clientDir, safeFolderName(opts.accountMask))
  await mkdir(acctDir, { recursive: true })

  const ext = opts.format.toLowerCase()
  const name = `${safeFolderName(opts.accountMask)} (${opts.from} to ${opts.to}).${ext}`
  const file = join(acctDir, name)
  await writeFile(file, opts.content, 'utf8')

  return { dir: clientDir, file }
}
