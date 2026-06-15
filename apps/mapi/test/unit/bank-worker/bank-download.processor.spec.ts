import { BankDownloadProcessor } from '../../../src/modules/22-bank-worker/bank-download.queue'
import type { BankDownloadService } from '../../../src/modules/22-bank-worker/bank-download.service'
import type { BankDownloadJob } from '../../../src/modules/22-bank-worker/bank-download.queue'
import type { Job } from 'bullmq'

/**
 * Tests Tipo A para el worker de descarga. Verifica que enruta el job al método
 * correcto del service por `kind`, pasando (clientId, dto, userId), y reporta
 * progreso. NO toca Redis ni el banco (service mockeado).
 */

function fakeJob(data: BankDownloadJob): Job<BankDownloadJob> {
  return {
    data,
    updateProgress: jest.fn().mockResolvedValue(undefined),
  } as unknown as Job<BankDownloadJob>
}

function build() {
  const service = {
    downloadChecks: jest.fn().mockResolvedValue({ ok: 'checks' }),
    downloadDeposits: jest.fn().mockResolvedValue({ ok: 'deposits' }),
    downloadStatements: jest.fn().mockResolvedValue({ ok: 'statements' }),
    downloadTransactions: jest.fn().mockResolvedValue({ ok: 'transactions' }),
  } as unknown as jest.Mocked<BankDownloadService>
  return { service, proc: new BankDownloadProcessor(service) }
}

describe('BankDownloadProcessor', () => {
  it('CR-bw-q-001: kind=checks → downloadChecks(clientId, dto, userId) + progreso 100', async () => {
    const { service, proc } = build()
    const dto = { credentialId: 'cred', accountMasks: ['9027'] } as never
    const job = fakeJob({ kind: 'checks', clientId: 'c1', userId: 'u1', dto })

    const res = await proc.process(job)

    expect(service.downloadChecks).toHaveBeenCalledWith('c1', dto, 'u1')
    expect(res).toEqual({ ok: 'checks' })
    expect(job.updateProgress).toHaveBeenCalledWith(100)
  })

  it('CR-bw-q-002: enruta deposits / statements / transactions por kind', async () => {
    const { service, proc } = build()
    await proc.process(fakeJob({ kind: 'deposits', clientId: 'c', userId: 'u', dto: {} as never }))
    await proc.process(
      fakeJob({ kind: 'statements', clientId: 'c', userId: 'u', dto: {} as never }),
    )
    await proc.process(
      fakeJob({ kind: 'transactions', clientId: 'c', userId: 'u', dto: {} as never }),
    )

    expect(service.downloadDeposits).toHaveBeenCalledTimes(1)
    expect(service.downloadStatements).toHaveBeenCalledTimes(1)
    expect(service.downloadTransactions).toHaveBeenCalledTimes(1)
  })
})
