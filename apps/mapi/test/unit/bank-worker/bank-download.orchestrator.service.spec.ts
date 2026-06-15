import { BadRequestException } from '@nestjs/common'
import { BankDownloadOrchestratorService } from '../../../src/modules/22-bank-worker/bank-download.orchestrator.service'
import type { ClientsService } from '../../../src/modules/11-clients/clients.service'
import type { ClientsRepository } from '../../../src/modules/11-clients/clients.repository'
import type { BankDownloadService } from '../../../src/modules/22-bank-worker/bank-download.service'
import type { BankSessionService } from '../../../src/modules/22-bank-worker/bank-session.service'
import type { BankDownloadQueueService } from '../../../src/modules/22-bank-worker/bank-download.queue'
import type { Client } from '../../../src/db/schema/clients'
import {
  DownloadClientAmbiguousError,
  DownloadClientNotResolvedError,
  MultipleDownloadableCredentialsError,
  NoDownloadableCredentialError,
} from '../../../src/modules/22-bank-worker/bank-worker.errors'

const CID = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa'
const CRED = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb'

function client(over: Partial<Client> = {}): Client {
  return { id: CID, legalName: 'Carnitas Don Raul, LLC', ...over } as Client
}

/** Una credencial del picker (listCredentials). */
function cred(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    credential_id: CRED,
    portal: { id: 'p1', name: 'Chase Bank', portal_url: null },
    nickname: null,
    status: 'active',
    download_supported: true,
    accounts: [],
    ...over,
  }
}

const LIVE = {
  credential_id: CRED,
  portal: 'Chase Bank',
  today: '06-15-2026',
  timezone: 'America/Chicago',
  accounts: [
    { mask: '7011', type: 'checking', name: 'CHK' },
    { mask: '3269', type: 'credit', name: 'CC' },
    { mask: '3269', type: 'credit', name: 'CC2' }, // mask duplicada → dedupe
  ],
}

interface Mocks {
  clients: { resolve: jest.Mock }
  clientsRepo: { findById: jest.Mock }
  downloads: { listCredentials: jest.Mock }
  session: { listAccounts: jest.Mock }
  queue: { runAndWait: jest.Mock }
}

function makeMocks(over: Partial<Mocks> = {}): Mocks {
  return {
    clients: { resolve: jest.fn().mockResolvedValue({ status: 'resolved', client: client() }) },
    clientsRepo: { findById: jest.fn().mockResolvedValue(client()) },
    downloads: { listCredentials: jest.fn().mockResolvedValue({ data: [cred()] }) },
    session: { listAccounts: jest.fn().mockResolvedValue(LIVE) },
    queue: { runAndWait: jest.fn().mockResolvedValue({ ok: 'statements' }) },
    ...over,
  }
}

function build(m: Mocks): BankDownloadOrchestratorService {
  return new BankDownloadOrchestratorService(
    m.clients as unknown as ClientsService,
    m.clientsRepo as unknown as ClientsRepository,
    m.downloads as unknown as BankDownloadService,
    m.session as unknown as BankSessionService,
    m.queue as unknown as BankDownloadQueueService,
  )
}

describe('BankDownloadOrchestratorService.orchestrate', () => {
  it('CR-bw-orq-001: nombre resuelto → login + descarga, encola con masks deduplicadas', async () => {
    const m = makeMocks()
    const res = await build(m).orchestrate(
      { client: 'carnitas', what: 'statements', params: { latest: true } },
      'user-1',
    )

    expect(m.clients.resolve).toHaveBeenCalledWith('carnitas')
    expect(m.session.listAccounts).toHaveBeenCalledWith(CID, CRED, 'user-1')
    const job = m.queue.runAndWait.mock.calls[0][0]
    expect(job).toMatchObject({ kind: 'statements', clientId: CID, userId: 'user-1' })
    expect(job.dto).toMatchObject({
      credentialId: CRED,
      accountMasks: ['7011', '3269'],
      latest: true,
    })
    expect(res).toMatchObject({
      client: { id: CID, legal_name: 'Carnitas Don Raul, LLC' },
      credential_id: CRED,
      portal: 'Chase Bank',
      what: 'statements',
      accounts_used: ['7011', '3269'],
      result: { ok: 'statements' },
    })
  })

  it('CR-bw-orq-002: input UUID → findById, sin resolve', async () => {
    const m = makeMocks()
    await build(m).orchestrate({ client: CID, what: 'statements', params: { latest: true } }, 'u')
    expect(m.clientsRepo.findById).toHaveBeenCalledWith(CID)
    expect(m.clients.resolve).not.toHaveBeenCalled()
  })

  it('CR-bw-orq-003: nombre sin match → DownloadClientNotResolvedError', async () => {
    const m = makeMocks({
      clients: { resolve: jest.fn().mockResolvedValue({ status: 'not_found' }) },
    })
    await expect(
      build(m).orchestrate({ client: 'zzz', what: 'statements', params: { latest: true } }, 'u'),
    ).rejects.toBeInstanceOf(DownloadClientNotResolvedError)
  })

  it('CR-bw-orq-004: ambiguo pero solo 1 candidato con descarga → auto-elige', async () => {
    const c1 = client({ id: CID, legalName: 'Carnitas Don Raul, LLC' })
    const c2 = client({ id: 'cccccccc-cccc-4ccc-cccc-cccccccccccc', legalName: 'Carnitas #2' })
    const m = makeMocks({
      clients: {
        resolve: jest.fn().mockResolvedValue({ status: 'ambiguous', candidates: [c1, c2] }),
      },
      downloads: {
        listCredentials: jest.fn(async (id: string) =>
          id === CID ? { data: [cred()] } : { data: [] },
        ),
      },
    })
    const res = await build(m).orchestrate(
      { client: 'carnitas', what: 'statements', params: { latest: true } },
      'u',
    )
    expect(res.client.id).toBe(CID)
  })

  it('CR-bw-orq-005: ambiguo con 2+ descargables → DownloadClientAmbiguousError + candidatos', async () => {
    const c1 = client({ id: CID })
    const c2 = client({ id: 'cccccccc-cccc-4ccc-cccc-cccccccccccc', legalName: 'Carnitas #2' })
    const m = makeMocks({
      clients: {
        resolve: jest.fn().mockResolvedValue({ status: 'ambiguous', candidates: [c1, c2] }),
      },
      downloads: { listCredentials: jest.fn().mockResolvedValue({ data: [cred()] }) },
    })
    await expect(
      build(m).orchestrate(
        { client: 'carnitas', what: 'statements', params: { latest: true } },
        'u',
      ),
    ).rejects.toBeInstanceOf(DownloadClientAmbiguousError)
  })

  it('CR-bw-orq-006: cliente sin credencial descargable → NoDownloadableCredentialError', async () => {
    const m = makeMocks({
      downloads: { listCredentials: jest.fn().mockResolvedValue({ data: [] }) },
    })
    await expect(
      build(m).orchestrate(
        { client: 'carnitas', what: 'statements', params: { latest: true } },
        'u',
      ),
    ).rejects.toBeInstanceOf(NoDownloadableCredentialError)
  })

  it('CR-bw-orq-007: 2+ credenciales descargables sin forzar → MultipleDownloadableCredentialsError', async () => {
    const m = makeMocks({
      downloads: {
        listCredentials: jest.fn().mockResolvedValue({
          data: [cred(), cred({ credential_id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' })],
        }),
      },
    })
    await expect(
      build(m).orchestrate(
        { client: 'carnitas', what: 'statements', params: { latest: true } },
        'u',
      ),
    ).rejects.toBeInstanceOf(MultipleDownloadableCredentialsError)
  })

  it('CR-bw-orq-008: credentialId forzado elige esa credencial', async () => {
    const forced = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
    const m = makeMocks({
      downloads: {
        listCredentials: jest.fn().mockResolvedValue({
          data: [cred(), cred({ credential_id: forced })],
        }),
      },
    })
    const res = await build(m).orchestrate(
      { client: 'carnitas', what: 'statements', credentialId: forced, params: { latest: true } },
      'u',
    )
    expect(res.credential_id).toBe(forced)
    expect(m.session.listAccounts).toHaveBeenCalledWith(CID, forced, 'u')
  })

  it('CR-bw-orq-009: accounts explícitas → usa esas (deduplicadas), no todas', async () => {
    const m = makeMocks()
    await build(m).orchestrate(
      {
        client: 'carnitas',
        what: 'statements',
        accounts: ['7011', '7011'],
        params: { latest: true },
      },
      'u',
    )
    expect(m.queue.runAndWait.mock.calls[0][0].dto.accountMasks).toEqual(['7011'])
  })

  it('CR-bw-orq-010: params inválidos para el tipo → BadRequestException (400)', async () => {
    const m = makeMocks()
    // statements requiere latest XOR year; {} es inválido.
    await expect(
      build(m).orchestrate({ client: 'carnitas', what: 'statements', params: {} }, 'u'),
    ).rejects.toBeInstanceOf(BadRequestException)
    expect(m.queue.runAndWait).not.toHaveBeenCalled()
  })
})
