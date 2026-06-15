import { BadRequestException } from '@nestjs/common'
import { BankDownloadOrchestratorService } from '../../../src/modules/22-bank-worker/bank-download.orchestrator.service'
import type { ClientsService } from '../../../src/modules/11-clients/clients.service'
import type { ClientsRepository } from '../../../src/modules/11-clients/clients.repository'
import type { BankDownloadService } from '../../../src/modules/22-bank-worker/bank-download.service'
import type { BankDownloadQueueService } from '../../../src/modules/22-bank-worker/bank-download.queue'
import type { Client } from '../../../src/db/schema/clients'

const CID = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa'
const CID2 = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const CRED = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb'

function client(over: Partial<Client> = {}): Client {
  return { id: CID, legalName: 'Carnitas Don Raul, LLC', ...over } as Client
}

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

interface Mocks {
  clients: { resolve: jest.Mock }
  clientsRepo: { findById: jest.Mock }
  downloads: { listCredentials: jest.Mock }
  queue: { enqueue: jest.Mock }
}

function makeMocks(over: Partial<Mocks> = {}): Mocks {
  return {
    clients: { resolve: jest.fn().mockResolvedValue({ status: 'resolved', client: client() }) },
    clientsRepo: { findById: jest.fn().mockResolvedValue(client()) },
    downloads: { listCredentials: jest.fn().mockResolvedValue({ data: [cred()] }) },
    queue: { enqueue: jest.fn().mockResolvedValue('job-1') },
    ...over,
  }
}

function build(m: Mocks): BankDownloadOrchestratorService {
  return new BankDownloadOrchestratorService(
    m.clients as unknown as ClientsService,
    m.clientsRepo as unknown as ClientsRepository,
    m.downloads as unknown as BankDownloadService,
    m.queue as unknown as BankDownloadQueueService,
  )
}

describe('BankDownloadOrchestratorService.orchestrate', () => {
  it('CR-bw-orq-001: 1 cliente → encola 1 job client-download y devuelve jobId', async () => {
    const m = makeMocks()
    const res = await build(m).orchestrate(
      { client: 'carnitas', what: 'statements', params: { latest: true } },
      'user-1',
    )

    expect(m.queue.enqueue).toHaveBeenCalledTimes(1)
    const job = m.queue.enqueue.mock.calls[0][0]
    expect(job).toMatchObject({
      kind: 'client-download',
      what: 'statements',
      clientId: CID,
      credentialId: CRED,
      userId: 'user-1',
      accounts: 'all',
      params: { latest: true },
    })
    expect(res).toEqual({
      what: 'statements',
      jobs: [
        {
          client: 'carnitas',
          status: 'queued',
          clientId: CID,
          legalName: 'Carnitas Don Raul, LLC',
          jobId: 'job-1',
        },
      ],
    })
  })

  it('CR-bw-orq-002: array de clientes → 1 job por cliente', async () => {
    const c1 = client({ id: CID, legalName: 'Bilia Eatery, LLC' })
    const c2 = client({ id: CID2, legalName: 'SRE Services, LLC' })
    const m = makeMocks({
      clients: {
        resolve: jest
          .fn()
          .mockResolvedValueOnce({ status: 'resolved', client: c1 })
          .mockResolvedValueOnce({ status: 'resolved', client: c2 }),
      },
      queue: { enqueue: jest.fn().mockResolvedValueOnce('job-a').mockResolvedValueOnce('job-b') },
    })

    const res = await build(m).orchestrate(
      { client: ['bilia', 'sre'], what: 'statements', params: { latest: true } },
      'u',
    )

    expect(m.queue.enqueue).toHaveBeenCalledTimes(2)
    expect(res.jobs.map((j) => j.jobId)).toEqual(['job-a', 'job-b'])
    expect(res.jobs.map((j) => j.legalName)).toEqual(['Bilia Eatery, LLC', 'SRE Services, LLC'])
  })

  it('CR-bw-orq-003: un cliente que falla NO tumba el batch (entry error + sigue)', async () => {
    const ok = client({ id: CID, legalName: 'Bilia Eatery, LLC' })
    const m = makeMocks({
      clients: {
        resolve: jest
          .fn()
          .mockResolvedValueOnce({ status: 'not_found' }) // primer cliente falla
          .mockResolvedValueOnce({ status: 'resolved', client: ok }), // segundo OK
      },
    })

    const res = await build(m).orchestrate(
      { client: ['zzz', 'bilia'], what: 'statements', params: { latest: true } },
      'u',
    )

    expect(res.jobs[0]).toMatchObject({
      client: 'zzz',
      status: 'error',
      code: 'DOWNLOAD_CLIENT_NOT_RESOLVED',
    })
    expect(res.jobs[1]).toMatchObject({ client: 'bilia', status: 'queued', jobId: 'job-1' })
    expect(m.queue.enqueue).toHaveBeenCalledTimes(1) // solo el que resolvió
  })

  it('CR-bw-orq-004: input UUID → findById, sin resolve', async () => {
    const m = makeMocks()
    await build(m).orchestrate({ client: CID, what: 'statements', params: { latest: true } }, 'u')
    expect(m.clientsRepo.findById).toHaveBeenCalledWith(CID)
    expect(m.clients.resolve).not.toHaveBeenCalled()
  })

  it('CR-bw-orq-005: ambiguo pero solo 1 candidato con descarga → auto-elige y encola', async () => {
    const c1 = client({ id: CID })
    const c2 = client({ id: CID2, legalName: 'Carnitas #2' })
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
    expect(res.jobs[0]).toMatchObject({ status: 'queued', clientId: CID })
  })

  it('CR-bw-orq-006: ambiguo con 2+ descargables → entry error DOWNLOAD_CLIENT_AMBIGUOUS', async () => {
    const c1 = client({ id: CID })
    const c2 = client({ id: CID2, legalName: 'Carnitas #2' })
    const m = makeMocks({
      clients: {
        resolve: jest.fn().mockResolvedValue({ status: 'ambiguous', candidates: [c1, c2] }),
      },
      downloads: { listCredentials: jest.fn().mockResolvedValue({ data: [cred()] }) },
    })
    const res = await build(m).orchestrate(
      { client: 'carnitas', what: 'statements', params: { latest: true } },
      'u',
    )
    expect(res.jobs[0]).toMatchObject({ status: 'error', code: 'DOWNLOAD_CLIENT_AMBIGUOUS' })
    expect(m.queue.enqueue).not.toHaveBeenCalled()
  })

  it('CR-bw-orq-007: sin credencial descargable → entry error NO_DOWNLOADABLE_CREDENTIAL', async () => {
    const m = makeMocks({
      downloads: { listCredentials: jest.fn().mockResolvedValue({ data: [] }) },
    })
    const res = await build(m).orchestrate(
      { client: 'carnitas', what: 'statements', params: { latest: true } },
      'u',
    )
    expect(res.jobs[0]).toMatchObject({ status: 'error', code: 'NO_DOWNLOADABLE_CREDENTIAL' })
  })

  it('CR-bw-orq-008: 2+ credenciales descargables sin forzar → entry error MULTIPLE', async () => {
    const m = makeMocks({
      downloads: {
        listCredentials: jest.fn().mockResolvedValue({
          data: [cred(), cred({ credential_id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' })],
        }),
      },
    })
    const res = await build(m).orchestrate(
      { client: 'carnitas', what: 'statements', params: { latest: true } },
      'u',
    )
    expect(res.jobs[0]).toMatchObject({
      status: 'error',
      code: 'MULTIPLE_DOWNLOADABLE_CREDENTIALS',
    })
  })

  it('CR-bw-orq-009: credentialId forzado (1 cliente) elige esa credencial', async () => {
    const forced = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
    const m = makeMocks({
      downloads: {
        listCredentials: jest
          .fn()
          .mockResolvedValue({ data: [cred(), cred({ credential_id: forced })] }),
      },
    })
    await build(m).orchestrate(
      { client: 'carnitas', what: 'statements', credentialId: forced, params: { latest: true } },
      'u',
    )
    expect(m.queue.enqueue.mock.calls[0][0].credentialId).toBe(forced)
  })

  it('CR-bw-orq-010: params inválidos para el tipo → 400, no encola nada', async () => {
    const m = makeMocks()
    await expect(
      build(m).orchestrate({ client: 'carnitas', what: 'statements', params: {} }, 'u'),
    ).rejects.toBeInstanceOf(BadRequestException)
    expect(m.queue.enqueue).not.toHaveBeenCalled()
  })
})
