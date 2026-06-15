import { join } from 'node:path'
import { Injectable } from '@nestjs/common'
import { ClientsRepository } from '../11-clients/clients.repository'
import { EventLogService } from '../95-event-log/event-log.service'
import { BankAccountsRepository } from './bank-accounts.repository'
import { BankPortalsRepository } from './bank-portals.repository'
import { ClientBankAccountsRepository } from './client-bank-accounts.repository'
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
import {
  BankAdapterNotSupportedError,
  BankPortalNotFoundError,
  ClientBankAccountNotFoundError,
} from './bank-worker.errors'
import type { BankPortal } from '../../db/schema/bank-portals'
import type { Client } from '../../db/schema/clients'
import type { ClientBankAccount } from '../../db/schema/client-bank-accounts'
import type {
  CredentialPickerItem,
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
  ListCredentialsResponse,
  ListStatementRefsDto,
  ListStatementRefsResponse,
} from './dto/bank-download.dto'

/** Cadencia entre fetches de imágenes (anti rate-limit del banco). */
const FETCH_PACE_MS = 300

/**
 * Step-flow de descarga bancaria — **orquestación** (D-mapi-BW-021).
 *
 * El adapter expone primitivas (`searchTransactions`, `downloadImage`,
 * `getDepositDetails`, `listStatements`, `downloadStatementPdf`,
 * `exportTransactions`); este service hace el trabajo pesado: itera cuentas,
 * resuelve rango/`latest`, ensambla los resultados, marca la cadencia y guarda.
 *
 * Design B (D-mapi-BW-012): corre sobre la **sesión viva** del banco vía el
 * bridge (kiro). El adapter NO recibe credenciales para los *fetches*.
 */
@Injectable()
export class BankDownloadService {
  constructor(
    private readonly credsRepo: ClientBankAccountsRepository,
    private readonly accountsRepo: BankAccountsRepository,
    private readonly portalsRepo: BankPortalsRepository,
    private readonly clientsRepo: ClientsRepository,
    private readonly executor: BridgeFetchExecutor,
    private readonly events: EventLogService,
  ) {}

  /**
   * Lista las credenciales del cliente con sus cuentas, para elegir cuál usar.
   * `portal` filtra difuso por nombre de portal (ej. "rbfcu"). Sin secretos.
   */
  async listCredentials(clientId: string, portal?: string): Promise<ListCredentialsResponse> {
    const { items } = await this.credsRepo.listGlobalWithJoins({ clientId })

    const needle = portal?.trim().toLowerCase()
    const rows = needle ? items.filter((r) => r.portal.name.toLowerCase().includes(needle)) : items

    const data: CredentialPickerItem[] = []
    for (const r of rows) {
      const accounts = await this.accountsRepo.listByCredential(r.credential.id)
      data.push({
        credential_id: r.credential.id,
        portal: { id: r.portal.id, name: r.portal.name, portal_url: r.portal.portal_url },
        nickname: r.credential.nickname,
        status: r.credential.status,
        download_supported: getAdapterFactory(r.portal.name) !== null,
        accounts: accounts.map((a) => ({
          id: a.id,
          mask: a.accountMask,
          type: a.accountType,
          label: a.label,
          status: a.status,
        })),
      })
    }

    return { data }
  }

  /** Descarga cheques (imagen frontal) de cada mask en el rango. */
  async downloadChecks(
    clientId: string,
    dto: DownloadChecksDto,
    userId: string,
    onProgress?: ProgressFn,
  ): Promise<DownloadChecksResponse> {
    const { cred, portal, adapter } = await this.resolveAdapter(clientId, dto.credentialId)
    const masks = dto.accountMasks
    const { client, from, to } = await this.resolveRange(clientId, dto)

    const accounts: DownloadChecksResponse['accounts'] = []
    let totalChecks = 0
    for (let mi = 0; mi < masks.length; mi++) {
      const mask = masks[mi]
      const txns = await adapter.searchTransactions(mask, from, to, 'CHECK')
      await this.report(onProgress, 'checks', mask, mi, masks.length, 0, txns.length)
      const checks: DownloadedImage[] = []
      for (let i = 0; i < txns.length; i++) {
        const tx = txns[i]
        if (!tx.sequenceNumber) continue
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
        clientName: client?.legalName ?? cred.id,
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

    await this.events.log(
      'bank.checks.downloaded',
      {
        client_bank_account_id: cred.id,
        client_id: clientId,
        portal: portal.name,
        range: { from, to },
        account_masks: masks,
        total_checks: totalChecks,
        saved: savedDir !== null,
      },
      userId,
      { type: 'client_bank_account', id: cred.id },
    )

    return {
      credential_id: cred.id,
      portal: portal.name,
      range: { from, to },
      accounts,
      total_checks: totalChecks,
      saved_dir: savedDir,
    }
  }

  /**
   * Descarga depósitos: el slip + cada cheque del depósito, por cada cuenta. Si
   * `save`, escribe PDFs `MM-DD-YYYY - <checkNumber> (<amount>).pdf` (CON monto).
   */
  async downloadDeposits(
    clientId: string,
    dto: DownloadDepositsDto,
    userId: string,
    onProgress?: ProgressFn,
  ): Promise<DownloadDepositsResponse> {
    const { cred, portal, adapter } = await this.resolveAdapter(clientId, dto.credentialId)
    const masks = dto.accountMasks
    const { client, from, to } = await this.resolveRange(clientId, dto)

    const accounts: DownloadDepositsResponse['accounts'] = []
    let totalImages = 0
    for (let mi = 0; mi < masks.length; mi++) {
      const mask = masks[mi]
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
          await this.pace()
        }

        const innerChecks = details.transactions ?? []
        for (let ci = 0; ci < innerChecks.length; ci++) {
          const chk = innerChecks[ci]
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
        clientName: client?.legalName ?? cred.id,
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

    await this.events.log(
      'bank.deposits.downloaded',
      {
        client_bank_account_id: cred.id,
        client_id: clientId,
        portal: portal.name,
        range: { from, to },
        account_masks: masks,
        total_images: totalImages,
        saved: savedDir !== null,
      },
      userId,
      { type: 'client_bank_account', id: cred.id },
    )

    return {
      credential_id: cred.id,
      portal: portal.name,
      range: { from, to },
      accounts,
      total_images: totalImages,
      saved_dir: savedDir,
    }
  }

  /**
   * Descarga estados de cuenta (PDF). `latest` baja solo el más reciente; si no,
   * el rango de meses [`from` .. `to`] (`to` ausente → mes actual). Si `save`, los
   * escribe como `YYYY-MM.pdf`.
   */
  async downloadStatements(
    clientId: string,
    dto: DownloadStatementsDto,
    userId: string,
    onProgress?: ProgressFn,
  ): Promise<DownloadStatementsResponse> {
    const { cred, portal, adapter } = await this.resolveAdapter(clientId, dto.credentialId)
    const masks = dto.accountMasks
    const client = await this.clientsRepo.findById(clientId)
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
        clientName: client?.legalName ?? cred.id,
        accounts: accounts.map((a) => ({ account_mask: a.account_mask, statements: a.statements })),
      })
      savedDir = dir
      for (const a of accounts) for (const s of a.statements) s.pdfBase64 = undefined
    }

    await this.events.log(
      'bank.statements.downloaded',
      {
        client_bank_account_id: cred.id,
        client_id: clientId,
        portal: portal.name,
        account_masks: masks,
        latest: dto.latest === true,
        total_statements: total,
        saved: savedDir !== null,
      },
      userId,
      { type: 'client_bank_account', id: cred.id },
    )

    return {
      credential_id: cred.id,
      portal: portal.name,
      accounts,
      total_statements: total,
      saved_dir: savedDir,
    }
  }

  /** Descarga el export de transacciones (CSV/QBO) por cuenta. */
  async downloadTransactions(
    clientId: string,
    dto: DownloadTransactionsDto,
    userId: string,
    onProgress?: ProgressFn,
  ): Promise<DownloadTransactionsResponse> {
    const { cred, portal, adapter } = await this.resolveAdapter(clientId, dto.credentialId)
    const masks = dto.accountMasks
    const { client, from, to } = await this.resolveRange(clientId, dto)

    const accounts: DownloadTransactionsResponse['accounts'] = []
    let savedDir: string | null = null
    for (let mi = 0; mi < masks.length; mi++) {
      const mask = masks[mi]
      const buffer = await adapter.exportTransactions(mask, from, to, dto.format)
      const content = buffer.toString('utf8')
      if (dto.save) {
        const { dir } = await saveTransactionFileToDisk({
          baseDir: join(process.cwd(), DEMO_DOWNLOADS_DIR),
          clientName: client?.legalName ?? cred.id,
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

    await this.events.log(
      'bank.transactions.downloaded',
      {
        client_bank_account_id: cred.id,
        client_id: clientId,
        portal: portal.name,
        range: { from, to },
        format: dto.format,
        account_masks: masks,
        saved: savedDir !== null,
      },
      userId,
      { type: 'client_bank_account', id: cred.id },
    )

    return {
      credential_id: cred.id,
      portal: portal.name,
      range: { from, to },
      format: dto.format,
      accounts,
      saved_dir: savedDir,
    }
  }

  // ── Read verbs (preview, sin descargar imágenes) — v0.23.0 ────────────────

  /** Cuenta/lista cheques por cuenta en el rango (sin bajar imágenes). */
  async listChecks(clientId: string, dto: ListActivityDto): Promise<ListActivityResponse> {
    return this.listActivity(clientId, dto, 'CHECK')
  }

  /** Cuenta/lista depósitos por cuenta en el rango (sin bajar imágenes). */
  async listDeposits(clientId: string, dto: ListActivityDto): Promise<ListActivityResponse> {
    return this.listActivity(clientId, dto, 'DEPOSIT')
  }

  private async listActivity(
    clientId: string,
    dto: ListActivityDto,
    type: 'CHECK' | 'DEPOSIT',
  ): Promise<ListActivityResponse> {
    const { cred, portal, adapter } = await this.resolveAdapter(clientId, dto.credentialId)
    const { from, to } = await this.resolveRange(clientId, dto)

    const accounts: ListActivityResponse['accounts'] = []
    let total = 0
    for (const mask of dto.accountMasks) {
      const txns = await adapter.searchTransactions(mask, from, to, type)
      accounts.push({ account_mask: mask, count: txns.length, items: txns })
      total += txns.length
    }

    return { credential_id: cred.id, portal: portal.name, range: { from, to }, accounts, total }
  }

  /** Lista los statements disponibles (metadata, sin bajar PDFs). */
  async listStatementRefs(
    clientId: string,
    dto: ListStatementRefsDto,
  ): Promise<ListStatementRefsResponse> {
    const { cred, portal, adapter } = await this.resolveAdapter(clientId, dto.credentialId)
    const yearsBack = dto.yearsBack ?? 1

    const accounts: ListStatementRefsResponse['accounts'] = []
    let total = 0
    for (const mask of dto.accountMasks) {
      const refs = await adapter.listStatements(mask, { yearsBack })
      accounts.push({ account_mask: mask, count: refs.length, items: refs })
      total += refs.length
    }

    return { credential_id: cred.id, portal: portal.name, accounts, total }
  }

  /**
   * Elige qué statements bajar de la lista cruda (por fecha DEL statement):
   * - `latest`     → solo el de fecha máxima.
   * - `from`/`to`  → rango de meses [from-01 .. fin de mes de `to`]. `to` ausente → mes actual.
   *   "mayo" exacto: from=to="2026-05". "enero a marzo": from="2026-01", to="2026-03".
   */
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
      high = new Date(ty, tm, 0) // último día del mes `to`
    } else {
      const now = new Date()
      high = new Date(now.getFullYear(), now.getMonth() + 1, 0) // fin del mes actual
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

  /** Pausa anti rate-limit entre fetches de imágenes. */
  private pace(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, FETCH_PACE_MS))
  }

  /** Emite un progreso (objeto) si hay callback. `accountIndex` se pasa 0-based. */
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

  /** Resuelve credencial → portal → adapter (errores 404/501). Compartido por las descargas. */
  private async resolveAdapter(
    clientId: string,
    credentialId: string,
  ): Promise<{ cred: ClientBankAccount; portal: BankPortal; adapter: BankAdapter }> {
    const cred = await this.credsRepo.findById(credentialId, clientId)
    if (!cred) throw new ClientBankAccountNotFoundError(credentialId)

    const portal = await this.portalsRepo.findById(cred.bankPortalId)
    if (!portal) throw new BankPortalNotFoundError(cred.bankPortalId)

    const factory = getAdapterFactory(portal.name)
    if (!factory) throw new BankAdapterNotSupportedError(portal.name)

    return { cred, portal, adapter: factory(this.executor) }
  }

  /** Resuelve el rango (preset o explícito → MM-DD-YYYY, zona del cliente) + el cliente. */
  private async resolveRange(
    clientId: string,
    dto: { range?: DownloadChecksDto['range']; from?: string; to?: string },
  ): Promise<{ client: Client | null; from: string; to: string }> {
    const client = await this.clientsRepo.findById(clientId)
    const { from, to } = resolveDateRange({
      range: dto.range,
      from: dto.from,
      to: dto.to,
      timezone: client?.timezone ?? null,
    })
    return { client, from, to }
  }
}
