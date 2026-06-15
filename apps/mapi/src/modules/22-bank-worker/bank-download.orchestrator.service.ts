import { Injectable } from '@nestjs/common'
import { ClientsService } from '../11-clients/clients.service'
import { ClientsRepository } from '../11-clients/clients.repository'
import { DomainError } from '../../common/errors/domain.error'
import type { Client } from '../../db/schema/clients'
import { BankDownloadService } from './bank-download.service'
import { BankDownloadQueueService } from './bank-download.queue'
import { validateParamsShape } from './bank-download.params'
import type {
  OrchestrateDownloadDto,
  OrchestrateDownloadResponse,
  OrchestrateJobEntry,
} from './dto/bank-download.dto'
import {
  DownloadClientAmbiguousError,
  DownloadClientNotResolvedError,
  MultipleDownloadableCredentialsError,
  NoDownloadableCredentialError,
} from './bank-worker.errors'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Verbo único de descarga (v0.27.0 → batch en v0.28.0). El cliente manda
 * `{ client, what, params }` donde `client` es uno o **varios** nombres/UUIDs.
 * mapi resuelve cada cliente + credencial **al recibir** (feedback inmediato de
 * qué se encoló y qué falló) y **encola 1 job por cliente** (`client-download`)
 * que el worker corre solo (login → descarga → logout), serializado por la cola.
 *
 * Async: responde con `{ jobs: [...] }` (jobId o error por cliente). El avance,
 * resultado y fallos quedan **registrados en bull-board** — si algo truena a
 * mitad del batch, ese job queda `failed` y los demás siguen.
 */
@Injectable()
export class BankDownloadOrchestratorService {
  constructor(
    private readonly clients: ClientsService,
    private readonly clientsRepo: ClientsRepository,
    private readonly downloads: BankDownloadService,
    private readonly queue: BankDownloadQueueService,
  ) {}

  async orchestrate(
    input: OrchestrateDownloadDto,
    userId: string,
  ): Promise<OrchestrateDownloadResponse> {
    const queries = Array.isArray(input.client) ? input.client : [input.client]
    const params = input.params ?? {}
    // Valida la forma de params UNA vez (es igual para todo el batch) → 400 si está mal.
    validateParamsShape(input.what, params)

    // `credentialId` forzado solo aplica con 1 cliente (con varios, cada uno resuelve el suyo).
    const forced = queries.length === 1 ? input.credentialId : undefined

    const jobs: OrchestrateJobEntry[] = []
    for (const q of queries) {
      try {
        const client = await this.resolveClient(q)
        const credentialId = await this.pickCredential(client, forced)
        const jobId = await this.queue.enqueue(
          {
            kind: 'client-download',
            what: input.what,
            clientId: client.id,
            credentialId,
            userId,
            accounts: input.accounts ?? 'all',
            params,
          },
          `${input.what} ${client.legalName}`,
        )
        jobs.push({
          client: q,
          status: 'queued',
          clientId: client.id,
          legalName: client.legalName,
          jobId,
        })
      } catch (err) {
        if (err instanceof DomainError) {
          jobs.push({ client: q, status: 'error', code: err.code, message: err.message })
        } else {
          throw err // errores no-dominio (400 de params ya salió arriba) → propaga.
        }
      }
    }
    return { what: input.what, jobs }
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
}
