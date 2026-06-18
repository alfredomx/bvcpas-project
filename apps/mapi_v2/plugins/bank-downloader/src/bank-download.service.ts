import { join } from 'node:path'
import { Inject, Injectable, Logger } from '@nestjs/common'
import { BANK_CREDENTIALS_PORT, type BankCredentialsPort } from '@/contracts/bank-credentials.port'
import { ClientsService } from '@/modules/11-clients/clients.service'
import { BridgeFetchExecutor } from './adapters/bridge-fetch-executor'
import { getAdapterFactory } from './adapters/adapter-registry'
import type { BankAdapter, StatementRef } from './adapters/bank-adapter.base'
import type {
  DepositResult,
  DownloadProgress,
  DownloadedImage,
  ProgressFn,
  StatementResult,
} from './bank-download.types'
import { resolveDateRange } from './date-range.util'
import {
  DEMO_DOWNLOADS_DIR,
  saveChecksToDisk,
  saveDepositsToDisk,
  saveStatementsToDisk,
  saveTransactionFileToDisk,
} from './bank-download.storage'
import { BankAdapterNotSupportedError } from './bank-download.errors'
import type {
  DownloadChecksDto,
  DownloadChecksResponse,
  DownloadDepositsDto,
  DownloadDepositsResponse,
  DownloadStatementsDto,
  DownloadStatementsResponse,
  DownloadTransactionsDto,
  DownloadTransactionsResponse,
  ListActivityDto,
  ListActivityResponse,
  ListStatementRefsDto,
  ListStatementRefsResponse,
} from './dto/bank-download.dto'

/** Cadencia entre fetches de imágenes (anti rate-limit del banco). */
const FETCH_PACE_MS = 300

interface ResolvedTarget {
  clientId: string
  portal: string
  adapter: BankAdapter
}

/**
 * Step-flow de descarga bancaria — **orquestación**. El adapter expone primitivas;
 * este service itera cuentas, resuelve rango/`latest`, ensambla resultados, marca
 * la cadencia y guarda. Corre sobre la sesión viva del banco vía el bridge (kiro):
 * el adapter NO recibe credenciales para los fetches.
 *
 * `clientId` se deriva del credential (vía `BANK_CREDENTIALS_PORT`): el caller solo
 * manda `credentialId`. Las masks vienen del DTO (no toca `bank_accounts`).
 */
@Injectable()
export class BankDownloadService {
  private readonly logger = new Logger(BankDownloadService.name)

  constructor(
    @Inject(BANK_CREDENTIALS_PORT) private readonly creds: BankCredentialsPort,
    private readonly clients: ClientsService,
    private readonly executor: BridgeFetchExecutor,
  ) {}

  /** Descarga cheques (imagen frontal) de cada mask en el rango. */
  async downloadChecks(
    dto: DownloadChecksDto,
    onProgress?: ProgressFn,
  ): Promise<DownloadChecksResponse> {
    const { clientId, portal, adapter } = await this.resolve(dto.credentialId)
    const masks = dto.accountMasks
    const { clientName, from, to } = await this.resolveRange(clientId, dto)

    const accounts: DownloadChecksResponse['accounts'] = []
    let totalChecks = 0
    for (let mi = 0; mi < masks.length; mi++) {
      const mask = masks[mi]
      // `searchTransactions` es la prueba de sesión: si falla (bridge caído, sin
      // sesión, sin pestaña same-origin) PROPAGA y el job falla honesto (no se
      // disfraza de "0 cheques"). Solo se aíslan los fallos por-imagen.
      const txns = await adapter.searchTransactions(mask, from, to, 'CHECK')
      await this.report(onProgress, 'checks', mask, mi, masks.length, 0, txns.length)
      const checks: DownloadedImage[] = []
      for (let i = 0; i < txns.length; i++) {
        const tx = txns[i]
        if (!tx.sequenceNumber) continue
        try {
          const img = await adapter.downloadImage(mask, tx.sequenceNumber, tx.date, 'CHECK')
          checks.push({
            sequenceNumber: tx.sequenceNumber,
            type: 'CHECK',
            frontImageBase64: img.front,
            rearImageBase64: img.rear,
            checkNumber: tx.checkNumber,
            postDate: tx.date,
            amount: tx.amount,
          })
        } catch (err) {
          // Best-effort por imagen: el search pasó (la sesión sirve), un cheque
          // sin imagen no bota el batch.
          this.logger.warn(
            `checks: imagen ${tx.sequenceNumber} (mask ${mask}) falló, se salta: ${
              err instanceof Error ? err.message : String(err)
            }`,
          )
        }
        await this.report(onProgress, 'checks', mask, mi, masks.length, i + 1, txns.length)
        if (i < txns.length - 1) await this.pace()
      }
      accounts.push({ account_mask: mask, count: checks.length, checks })
      totalChecks += checks.length
    }

    let savedDir: string | null = null
    if (dto.save) {
      const { dir } = await saveChecksToDisk({
        baseDir: join(process.cwd(), DEMO_DOWNLOADS_DIR),
        clientName,
        accounts,
      })
      savedDir = dir
      for (const a of accounts) {
        for (const c of a.checks) {
          c.frontImageBase64 = undefined
          c.rearImageBase64 = undefined
        }
      }
    }

    return {
      credential_id: dto.credentialId,
      portal,
      range: { from, to },
      accounts,
      total_checks: totalChecks,
      saved_dir: savedDir,
    }
  }

  /** Descarga depósitos: el slip + cada cheque del depósito, por cada cuenta. */
  async downloadDeposits(
    dto: DownloadDepositsDto,
    onProgress?: ProgressFn,
  ): Promise<DownloadDepositsResponse> {
    const { clientId, portal, adapter } = await this.resolve(dto.credentialId)
    const masks = dto.accountMasks
    const { clientName, from, to } = await this.resolveRange(clientId, dto)

    const accounts: DownloadDepositsResponse['accounts'] = []
    let totalImages = 0
    for (let mi = 0; mi < masks.length; mi++) {
      const mask = masks[mi]
      // `searchTransactions`/`getDepositDetails` son la prueba de sesión → PROPAGAN
      // (job falla honesto). Solo se aíslan los fallos por-imagen.
      const deps = await adapter.searchTransactions(mask, from, to, 'DEPOSIT')
      await this.report(onProgress, 'deposits', mask, mi, masks.length, 0, deps.length)
      const deposits: DepositResult[] = []
      for (let di = 0; di < deps.length; di++) {
        const dep = deps[di]
        const details = await adapter.getDepositDetails(mask, dep)
        const result: DepositResult = {
          depositSequenceNumber: details.depositSequenceNumber ?? dep.sequenceNumber,
          totalAmount: details.totalDepositAmount ?? dep.amount ?? 0,
          checksImages: [],
        }

        if (details.depositSlipAvailable) {
          try {
            const slip = await adapter.downloadImage(
              mask,
              result.depositSequenceNumber,
              dep.date,
              'DEPOSIT_SLIP',
            )
            result.depositSlipImage = {
              sequenceNumber: result.depositSequenceNumber,
              type: 'DEPOSIT_SLIP',
              frontImageBase64: slip.front,
              rearImageBase64: slip.rear,
              checkNumber: dep.checkNumber,
              postDate: dep.date,
              amount: result.totalAmount,
            }
          } catch (err) {
            this.logger.warn(
              `deposits: slip ${result.depositSequenceNumber} (mask ${mask}) falló, se salta: ${
                err instanceof Error ? err.message : String(err)
              }`,
            )
          }
          await this.pace()
        }

        const innerChecks = details.transactions ?? []
        for (let ci = 0; ci < innerChecks.length; ci++) {
          const chk = innerChecks[ci]
          try {
            const img = await adapter.downloadImage(
              mask,
              chk.sequenceNumber,
              chk.postDate ?? dep.date,
              'CHECK',
            )
            result.checksImages.push({
              sequenceNumber: chk.sequenceNumber,
              type: 'CHECK',
              frontImageBase64: img.front,
              rearImageBase64: img.rear,
              checkNumber: chk.checkNumber,
              postDate: chk.postDate ?? dep.date,
              amount: chk.amount,
            })
          } catch (err) {
            this.logger.warn(
              `deposits: imagen ${chk.sequenceNumber} (mask ${mask}) falló, se salta: ${
                err instanceof Error ? err.message : String(err)
              }`,
            )
          }
          if (ci < innerChecks.length - 1) await this.pace()
        }

        deposits.push(result)
        await this.report(onProgress, 'deposits', mask, mi, masks.length, di + 1, deps.length)
        if (di < deps.length - 1) await this.pace()
      }

      const imageCount = deposits.reduce(
        (n, d) => n + (d.depositSlipImage ? 1 : 0) + d.checksImages.length,
        0,
      )
      accounts.push({
        account_mask: mask,
        deposit_count: deposits.length,
        image_count: imageCount,
        deposits,
      })
      totalImages += imageCount
    }

    let savedDir: string | null = null
    if (dto.save) {
      const { dir } = await saveDepositsToDisk({
        baseDir: join(process.cwd(), DEMO_DOWNLOADS_DIR),
        clientName,
        accounts: accounts.map((a) => ({ account_mask: a.account_mask, deposits: a.deposits })),
      })
      savedDir = dir
      for (const a of accounts) {
        for (const d of a.deposits) {
          if (d.depositSlipImage) {
            d.depositSlipImage.frontImageBase64 = undefined
            d.depositSlipImage.rearImageBase64 = undefined
          }
          for (const c of d.checksImages) {
            c.frontImageBase64 = undefined
            c.rearImageBase64 = undefined
          }
        }
      }
    }

    return {
      credential_id: dto.credentialId,
      portal,
      range: { from, to },
      accounts,
      total_images: totalImages,
      saved_dir: savedDir,
    }
  }

  /** Descarga estados de cuenta (PDF). `latest` baja solo el más reciente; si no, el rango. */
  async downloadStatements(
    dto: DownloadStatementsDto,
    onProgress?: ProgressFn,
  ): Promise<DownloadStatementsResponse> {
    const { clientId, portal, adapter } = await this.resolve(dto.credentialId)
    const masks = dto.accountMasks
    const client = await this.clients.getById(clientId)
    const yearsBack = dto.latest
      ? 1
      : Math.max(0, new Date().getFullYear() - parseInt((dto.from ?? '').slice(0, 4), 10))

    const accounts: DownloadStatementsResponse['accounts'] = []
    let total = 0
    for (let mi = 0; mi < masks.length; mi++) {
      const mask = masks[mi]
      const refs = await adapter.listStatements(mask, { yearsBack })
      const selected = this.selectStatements(refs, dto)
      await this.report(onProgress, 'statements', mask, mi, masks.length, 0, selected.length)
      const statements: StatementResult[] = []
      for (let i = 0; i < selected.length; i++) {
        const pdf = await adapter.downloadStatementPdf(mask, selected[i])
        statements.push({
          documentId: selected[i].documentId,
          date: selected[i].date,
          pdfBase64: pdf.toString('base64'),
        })
        await this.report(onProgress, 'statements', mask, mi, masks.length, i + 1, selected.length)
        if (i < selected.length - 1) await this.pace()
      }
      accounts.push({ account_mask: mask, count: statements.length, statements })
      total += statements.length
    }

    let savedDir: string | null = null
    if (dto.save) {
      const { dir } = await saveStatementsToDisk({
        baseDir: join(process.cwd(), DEMO_DOWNLOADS_DIR),
        clientName: client.legalName,
        accounts: accounts.map((a) => ({ account_mask: a.account_mask, statements: a.statements })),
      })
      savedDir = dir
      for (const a of accounts) for (const s of a.statements) s.pdfBase64 = undefined
    }

    return {
      credential_id: dto.credentialId,
      portal,
      accounts,
      total_statements: total,
      saved_dir: savedDir,
    }
  }

  /** Descarga el export de transacciones (CSV/QBO) por cuenta. */
  async downloadTransactions(
    dto: DownloadTransactionsDto,
    onProgress?: ProgressFn,
  ): Promise<DownloadTransactionsResponse> {
    const { clientId, portal, adapter } = await this.resolve(dto.credentialId)
    const masks = dto.accountMasks
    const { clientName, from, to } = await this.resolveRange(clientId, dto)

    const accounts: DownloadTransactionsResponse['accounts'] = []
    let savedDir: string | null = null
    for (let mi = 0; mi < masks.length; mi++) {
      const mask = masks[mi]
      const buffer = await adapter.exportTransactions(mask, from, to, dto.format)
      const content = buffer.toString('utf8')
      if (dto.save) {
        const { dir } = await saveTransactionFileToDisk({
          baseDir: join(process.cwd(), DEMO_DOWNLOADS_DIR),
          clientName,
          accountMask: mask,
          from,
          to,
          format: dto.format,
          content,
        })
        savedDir = dir
      }
      accounts.push({
        account_mask: mask,
        bytes: buffer.length,
        content: dto.save ? undefined : content,
      })
      await this.report(onProgress, 'transactions', mask, mi, masks.length, 1, 1)
    }

    return {
      credential_id: dto.credentialId,
      portal,
      range: { from, to },
      format: dto.format,
      accounts,
      saved_dir: savedDir,
    }
  }

  // ── Read verbs (preview, sin descargar imágenes) ──────────────────────────

  async listChecks(dto: ListActivityDto): Promise<ListActivityResponse> {
    return this.listActivity(dto, 'CHECK')
  }

  async listDeposits(dto: ListActivityDto): Promise<ListActivityResponse> {
    return this.listActivity(dto, 'DEPOSIT')
  }

  private async listActivity(
    dto: ListActivityDto,
    type: 'CHECK' | 'DEPOSIT',
  ): Promise<ListActivityResponse> {
    const { clientId, portal, adapter } = await this.resolve(dto.credentialId)
    const { from, to } = await this.resolveRange(clientId, dto)

    const accounts: ListActivityResponse['accounts'] = []
    let total = 0
    for (const mask of dto.accountMasks) {
      const txns = await adapter.searchTransactions(mask, from, to, type)
      accounts.push({ account_mask: mask, count: txns.length, items: txns })
      total += txns.length
    }

    return { credential_id: dto.credentialId, portal, range: { from, to }, accounts, total }
  }

  async listStatementRefs(dto: ListStatementRefsDto): Promise<ListStatementRefsResponse> {
    const { portal, adapter } = await this.resolve(dto.credentialId)
    const yearsBack = dto.yearsBack ?? 1

    const accounts: ListStatementRefsResponse['accounts'] = []
    let total = 0
    for (const mask of dto.accountMasks) {
      const refs = await adapter.listStatements(mask, { yearsBack })
      accounts.push({ account_mask: mask, count: refs.length, items: refs })
      total += refs.length
    }

    return { credential_id: dto.credentialId, portal, accounts, total }
  }

  /** Elige qué statements bajar (por fecha DEL statement): `latest` o rango de meses. */
  private selectStatements(refs: StatementRef[], dto: DownloadStatementsDto): StatementRef[] {
    if (dto.latest) {
      if (refs.length === 0) return []
      return [refs.reduce((a, b) => (a.date >= b.date ? a : b))]
    }
    const [fy, fm] = (dto.from ?? '').split('-').map((s) => parseInt(s, 10))
    const low = new Date(fy, fm - 1, 1)
    let high: Date
    if (dto.to) {
      const [ty, tm] = dto.to.split('-').map((s) => parseInt(s, 10))
      high = new Date(ty, tm, 0)
    } else {
      const now = new Date()
      high = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    }
    return refs.filter((r) => {
      if (!/^\d{8}$/.test(r.date)) return false
      const dt = new Date(
        parseInt(r.date.substring(0, 4), 10),
        parseInt(r.date.substring(4, 6), 10) - 1,
        parseInt(r.date.substring(6, 8), 10),
      )
      return dt >= low && dt <= high
    })
  }

  private pace(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, FETCH_PACE_MS))
  }

  private async report(
    onProgress: ProgressFn | undefined,
    stage: DownloadProgress['stage'],
    account: string,
    accountIndex: number,
    accountTotal: number,
    done: number,
    total: number,
  ): Promise<void> {
    if (!onProgress) return
    await onProgress({ stage, account, accountIndex: accountIndex + 1, accountTotal, done, total })
  }

  /** Credencial → portal → adapter. Deriva `clientId` del credential (puerto). */
  private async resolve(credentialId: string): Promise<ResolvedTarget> {
    const cred = await this.creds.getDecrypted(credentialId)
    const factory = getAdapterFactory(cred.portalName)
    if (!factory) throw new BankAdapterNotSupportedError(cred.portalName)
    return { clientId: cred.clientId, portal: cred.portalName, adapter: factory(this.executor) }
  }

  /** Resuelve el rango (preset/explícito → MM-DD-YYYY, zona del cliente) + el nombre del cliente. */
  private async resolveRange(
    clientId: string,
    dto: { range?: DownloadChecksDto['range']; from?: string; to?: string },
  ): Promise<{ clientName: string; from: string; to: string }> {
    const client = await this.clients.getById(clientId)
    const { from, to } = resolveDateRange({
      range: dto.range,
      from: dto.from,
      to: dto.to,
      timezone: client.timezone,
    })
    return { clientName: client.legalName, from, to }
  }
}
