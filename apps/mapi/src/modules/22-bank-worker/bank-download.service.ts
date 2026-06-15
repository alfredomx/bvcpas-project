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
import type { DepositResult, DownloadedImage, StatementResult } from './bank-download.types'
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
  ListCredentialsResponse,
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
  ): Promise<DownloadChecksResponse> {
    const { cred, portal, adapter } = await this.resolveAdapter(clientId, dto.credentialId)
    const masks = dto.accountMasks
    const { client, from, to } = await this.resolveRange(clientId, dto)

    const accounts: DownloadChecksResponse['accounts'] = []
    let totalChecks = 0
    for (const mask of masks) {
      const txns = await adapter.searchTransactions(mask, from, to, 'CHECK')
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
  ): Promise<DownloadDepositsResponse> {
    const { cred, portal, adapter } = await this.resolveAdapter(clientId, dto.credentialId)
    const masks = dto.accountMasks
    const { client, from, to } = await this.resolveRange(clientId, dto)

    const accounts: DownloadDepositsResponse['accounts'] = []
    let totalImages = 0
    for (const mask of masks) {
      const deps = await adapter.searchTransactions(mask, from, to, 'DEPOSIT')
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
   * desde `year`/`month` al mes actual. Si `save`, los escribe como `YYYY-MM.pdf`.
   */
  async downloadStatements(
    clientId: string,
    dto: DownloadStatementsDto,
    userId: string,
  ): Promise<DownloadStatementsResponse> {
    const { cred, portal, adapter } = await this.resolveAdapter(clientId, dto.credentialId)
    const masks = dto.accountMasks
    const client = await this.clientsRepo.findById(clientId)
    const yearsBack = dto.latest
      ? 1
      : Math.max(0, new Date().getFullYear() - parseInt(dto.year ?? '', 10))

    const accounts: DownloadStatementsResponse['accounts'] = []
    let total = 0
    for (const mask of masks) {
      const refs = await adapter.listStatements(mask, { yearsBack })
      const selected = this.selectStatements(refs, dto)
      const statements: StatementResult[] = []
      for (let i = 0; i < selected.length; i++) {
        const pdf = await adapter.downloadStatementPdf(mask, selected[i])
        statements.push({
          documentId: selected[i].documentId,
          date: selected[i].date,
          pdfBase64: pdf.toString('base64'),
        })
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
  ): Promise<DownloadTransactionsResponse> {
    const { cred, portal, adapter } = await this.resolveAdapter(clientId, dto.credentialId)
    const masks = dto.accountMasks
    const { client, from, to } = await this.resolveRange(clientId, dto)

    const accounts: DownloadTransactionsResponse['accounts'] = []
    let savedDir: string | null = null
    for (const mask of masks) {
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

  /**
   * Elige qué statements bajar de la lista cruda: `latest` → solo el de fecha
   * máxima; si no, filtra al rango [year/month .. mes actual].
   */
  private selectStatements(refs: StatementRef[], dto: DownloadStatementsDto): StatementRef[] {
    if (dto.latest) {
      if (refs.length === 0) return []
      return [refs.reduce((a, b) => (a.date >= b.date ? a : b))]
    }
    const yearFrom = parseInt(dto.year ?? '', 10)
    const monthFrom = parseInt(dto.month ?? '1', 10)
    const now = new Date()
    const low = new Date(yearFrom, monthFrom - 1, 1)
    const high = new Date(now.getFullYear(), now.getMonth() + 1, 0)
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
