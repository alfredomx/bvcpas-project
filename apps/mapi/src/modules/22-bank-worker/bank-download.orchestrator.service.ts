import { BadRequestException, Injectable } from '@nestjs/common'
import { z } from 'zod'
import { ClientsService } from '../11-clients/clients.service'
import { ClientsRepository } from '../11-clients/clients.repository'
import type { Client } from '../../db/schema/clients'
import { BankDownloadService } from './bank-download.service'
import { BankSessionService } from './bank-session.service'
import { BankDownloadQueueService, type BankDownloadJob } from './bank-download.queue'
import {
  DownloadChecksSchema,
  DownloadDepositsSchema,
  DownloadStatementsSchema,
  DownloadTransactionsSchema,
  type ListAccountsResponse,
  type OrchestrateDownloadDto,
  type OrchestrateDownloadResponse,
} from './dto/bank-download.dto'
import {
  DownloadClientAmbiguousError,
  DownloadClientNotResolvedError,
  MultipleDownloadableCredentialsError,
  NoDownloadableCredentialError,
} from './bank-worker.errors'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Schema de validación de `params` por tipo de descarga. */
const SCHEMA_BY_WHAT = {
  checks: DownloadChecksSchema,
  deposits: DownloadDepositsSchema,
  statements: DownloadStatementsSchema,
  transactions: DownloadTransactionsSchema,
} as const

/**
 * Verbo único de descarga (v0.27.0). Colapsa el flujo de 4 llamadas
 * (resolve → credencial → login → descarga) en UNA: el LLM/operador manda
 * `{ client, what, params }` y mapi encadena todo server-side. El logout +
 * cierre de pestaña ya es automático (v0.26.0, en el worker).
 *
 * - **Cliente por nombre**: resuelve por legal_name/alias/UUID. Si el nombre es
 *   ambiguo, auto-elige al único candidato con credencial descargable; si hay
 *   varios, devuelve candidatos (409) — cero adivinanza.
 * - **Credencial**: auto-elige la única con `download_supported` (Chase hoy); si
 *   hay varias, pide especificar (409, o `credentialId` explícito).
 * - **Descarga**: encola por la cola (bull-board + concurrency 1) y espera.
 */
@Injectable()
export class BankDownloadOrchestratorService {
  constructor(
    private readonly clients: ClientsService,
    private readonly clientsRepo: ClientsRepository,
    private readonly downloads: BankDownloadService,
    private readonly session: BankSessionService,
    private readonly queue: BankDownloadQueueService,
  ) {}

  async orchestrate(
    input: OrchestrateDownloadDto,
    userId: string,
  ): Promise<OrchestrateDownloadResponse> {
    const client = await this.resolveClient(input.client)
    const credentialId = await this.pickCredential(client, input.credentialId)

    // Login en vivo + cuentas reales (abre Chase y se loguea con el vault).
    const live = await this.session.listAccounts(client.id, credentialId, userId)
    const accountMasks = this.resolveMasks(live, input.accounts)

    const dto = this.buildDto(input.what, credentialId, accountMasks, input.params ?? {})
    const job = {
      kind: input.what,
      clientId: client.id,
      userId,
      dto,
    } as BankDownloadJob

    const result = await this.queue.runAndWait(job, `${input.what} ${client.legalName}`)

    return {
      client: { id: client.id, legal_name: client.legalName },
      credential_id: credentialId,
      portal: live.portal,
      what: input.what,
      accounts_used: accountMasks,
      result,
    }
  }

  /** Resuelve el cliente por UUID o nombre; desambigua por credencial descargable. */
  private async resolveClient(query: string): Promise<Client> {
    if (UUID_RE.test(query)) {
      const c = await this.clientsRepo.findById(query)
      if (!c) throw new DownloadClientNotResolvedError(query)
      return c
    }

    const r = await this.clients.resolve(query)
    if (r.status === 'resolved') return r.client
    if (r.status === 'not_found') throw new DownloadClientNotResolvedError(query)

    // Ambiguo: auto-elige si solo uno de los candidatos tiene descarga.
    const withDownload: Client[] = []
    for (const cand of r.candidates) {
      if (await this.hasDownloadableCredential(cand.id)) withDownload.push(cand)
    }
    if (withDownload.length === 1) return withDownload[0]
    const pool = withDownload.length > 0 ? withDownload : r.candidates
    throw new DownloadClientAmbiguousError(pool.map((c) => ({ id: c.id, legal_name: c.legalName })))
  }

  /** Elige la credencial descargable (Chase hoy); respeta `credentialId` forzado. */
  private async pickCredential(client: Client, forced?: string): Promise<string> {
    const downloadable = (await this.downloads.listCredentials(client.id)).data.filter(
      (c) => c.download_supported && c.status === 'active',
    )
    if (forced) {
      const hit = downloadable.find((c) => c.credential_id === forced)
      if (!hit) throw new NoDownloadableCredentialError(client.legalName)
      return hit.credential_id
    }
    if (downloadable.length === 0) throw new NoDownloadableCredentialError(client.legalName)
    if (downloadable.length === 1) return downloadable[0].credential_id
    throw new MultipleDownloadableCredentialsError(
      downloadable.map((c) => ({ credential_id: c.credential_id, portal: c.portal.name })),
    )
  }

  private async hasDownloadableCredential(clientId: string): Promise<boolean> {
    const creds = (await this.downloads.listCredentials(clientId)).data
    return creds.some((c) => c.download_supported && c.status === 'active')
  }

  /** "all" (o vacío) → todas las masks del login (deduplicadas); si no, las pedidas. */
  private resolveMasks(live: ListAccountsResponse, accounts?: 'all' | string[]): string[] {
    const source = !accounts || accounts === 'all' ? live.accounts.map((a) => a.mask) : accounts
    return [...new Set(source)]
  }

  /** Arma el DTO del tipo y lo valida con su schema; inválido → 400. */
  private buildDto(
    what: OrchestrateDownloadDto['what'],
    credentialId: string,
    accountMasks: string[],
    params: Record<string, unknown>,
  ): z.infer<(typeof SCHEMA_BY_WHAT)[typeof what]> {
    const parsed = SCHEMA_BY_WHAT[what].safeParse({ ...params, credentialId, accountMasks })
    if (!parsed.success) {
      throw new BadRequestException({
        message: `Parámetros inválidos para "${what}": ${parsed.error.issues
          .map((i) => i.message)
          .join('; ')}`,
      })
    }
    return parsed.data
  }
}
