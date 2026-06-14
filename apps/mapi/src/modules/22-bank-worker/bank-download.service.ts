import { join } from 'node:path'
import { Injectable } from '@nestjs/common'
import { ClientsRepository } from '../11-clients/clients.repository'
import { EventLogService } from '../95-event-log/event-log.service'
import { BankAccountsRepository } from './bank-accounts.repository'
import { BankPortalsRepository } from './bank-portals.repository'
import { ClientBankAccountsRepository } from './client-bank-accounts.repository'
import { BridgeFetchExecutor } from './adapters/bridge-fetch-executor'
import { getAdapterFactory } from './adapters/adapter-registry'
import type { BankAdapter } from './adapters/bank-adapter.base'
import type { DepositResult, DownloadedImage, StatementResult } from './adapters/chase.adapter'
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

/**
 * Step-flow de descarga bancaria (v0.21.0).
 *
 * Bloques discretos del flujo "descarga de <cliente> de <banco> todos los
 * cheques" (el `resolve_client` ya lo cubre 11-clients):
 *
 *  - `listCredentials(clientId, portal?)`: lista las credenciales del cliente
 *    (opcionalmente filtradas por portal), cada una con sus cuentas (masks).
 *    NUNCA expone username/password — es la vista para *elegir* credencial/cuenta.
 *
 *  - `downloadChecks(clientId, dto, userId)`: resuelve el rango (preset o
 *    explícito → MM-DD-YYYY), elige el adapter del portal de la credencial, y
 *    descarga cheques por cada cuenta (todas las activas, o solo la pedida).
 *
 * Design B (D-mapi-BW-012): la descarga corre sobre la **sesión viva** del banco
 * vía el bridge (`BridgeFetchExecutor` → kiro). El adapter NO recibe las
 * credenciales descifradas — operan en la pestaña ya logueada del operador. Por
 * eso este flujo no descifra `*_encrypted`.
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

  /**
   * Descarga cheques de la credencial en el rango dado. Si `accountMask` viene,
   * solo esa cuenta; si se omite, todas las cuentas activas de la credencial.
   */
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
      const checks = (await adapter.downloadChecks(mask, from, to)) as DownloadedImage[]
      accounts.push({ account_mask: mask, count: checks.length, checks })
      totalChecks += checks.length
    }

    // Demo: guardar a disco (D-mapi-BW-018). Si se guarda, se omite el base64 de
    // la respuesta (las imágenes quedan en archivos). Destino real (Dropbox) → BACKLOG.
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
   * `save`, escribe PDFs con el nombre `MM-DD-YYYY - <checkNumber> (<amount>).pdf`
   * (CON monto, como bankify).
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
      const deposits = (await adapter.downloadDeposits(mask, from, to)) as DepositResult[]
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
   * Descarga estados de cuenta (PDF) desde `year`/`month` al mes actual. Si
   * `save`, los escribe como `YYYY-MM.pdf` (como bankify).
   */
  async downloadStatements(
    clientId: string,
    dto: DownloadStatementsDto,
    userId: string,
  ): Promise<DownloadStatementsResponse> {
    const { cred, portal, adapter } = await this.resolveAdapter(clientId, dto.credentialId)
    const masks = dto.accountMasks
    const client = await this.clientsRepo.findById(clientId)

    const accounts: DownloadStatementsResponse['accounts'] = []
    let total = 0
    for (const mask of masks) {
      const statements = (await adapter.downloadStatements(
        mask,
        dto.year,
        dto.month ?? '1',
      )) as StatementResult[]
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

  /**
   * Descarga el export de transacciones (CSV/QBO) por cuenta. Si `save`, escribe
   * `<mask> (<from> to <to>).<csv|qbo>` (como bankify).
   */
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
      const buffer = (await adapter.downloadTransactions(mask, from, to, dto.format)) as Buffer
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
