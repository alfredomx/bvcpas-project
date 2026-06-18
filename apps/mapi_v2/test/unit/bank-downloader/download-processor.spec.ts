import { BankDownloadProcessor } from '@plugins/bank-downloader/src/bank-download.queue'
import type { BankDownloadService } from '@plugins/bank-downloader/src/bank-download.service'
import type { BankSessionService } from '@plugins/bank-downloader/src/bank-session.service'
import type { Queue, Job } from 'bullmq'
import type { BankDownloadJob } from '@plugins/bank-downloader/src/bank-download.queue'

const CRED = '7843f5af-405f-416c-a956-7171cb9668ad'

function job(over: Partial<BankDownloadJob> = {}): Job<BankDownloadJob> {
  const data = { kind: 'checks', dto: { credentialId: CRED, accountMasks: ['3703'] }, ...over }
  return { data, updateProgress: jest.fn() } as unknown as Job<BankDownloadJob>
}

function processor(opts: {
  listAccounts?: jest.Mock
  endSession?: jest.Mock
  download?: jest.Mock
  pending?: BankDownloadJob[]
}): {
  proc: BankDownloadProcessor
  session: { listAccounts: jest.Mock; endSession: jest.Mock }
  service: { downloadChecks: jest.Mock }
} {
  const session = {
    listAccounts: opts.listAccounts ?? jest.fn().mockResolvedValue([]),
    endSession: opts.endSession ?? jest.fn().mockResolvedValue(undefined),
  }
  const service = {
    downloadChecks: opts.download ?? jest.fn().mockResolvedValue({ total_checks: 5 }),
  }
  const queue = {
    getJobs: jest.fn().mockResolvedValue((opts.pending ?? []).map((d) => ({ data: d }))),
  }
  const proc = new BankDownloadProcessor(
    service as unknown as BankDownloadService,
    session as unknown as BankSessionService,
    queue as unknown as Queue,
  )
  return { proc, session, service }
}

describe('BankDownloadProcessor — el worker hace TODO', () => {
  it('asegura la sesión (login) ANTES de descargar y cierra al final', async () => {
    const order: string[] = []
    const listAccounts = jest.fn().mockImplementation(() => {
      order.push('login')
      return Promise.resolve([])
    })
    const download = jest.fn().mockImplementation(() => {
      order.push('download')
      return Promise.resolve({ total_checks: 5 })
    })
    const { proc, session } = processor({ listAccounts, download })

    const res = await proc.process(job())

    expect(order).toEqual(['login', 'download']) // login primero
    expect(session.listAccounts).toHaveBeenCalledWith(CRED)
    expect(session.endSession).toHaveBeenCalledWith(CRED) // sin pendientes → cierra
    expect(res).toEqual({ total_checks: 5 })
  })

  it('si el login falla, NO descarga, propaga, y aún así cierra la sesión', async () => {
    const listAccounts = jest.fn().mockRejectedValue(new Error('login falló'))
    const { proc, session, service } = processor({ listAccounts })

    await expect(proc.process(job())).rejects.toThrow('login falló')
    expect(service.downloadChecks).not.toHaveBeenCalled()
    expect(session.endSession).toHaveBeenCalledWith(CRED) // finally corre igual
  })

  it('NO cierra la sesión si otro job pendiente usa la misma credencial', async () => {
    const pending: BankDownloadJob = { kind: 'deposits', dto: { credentialId: CRED } as never }
    const { proc, session } = processor({ pending: [pending] })

    await proc.process(job())

    expect(session.endSession).not.toHaveBeenCalled() // se reusa la sesión viva
  })
})
