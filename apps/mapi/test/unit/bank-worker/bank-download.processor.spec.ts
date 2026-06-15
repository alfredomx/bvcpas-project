import { BankDownloadProcessor } from '../../../src/modules/22-bank-worker/bank-download.queue'
import type { BankDownloadService } from '../../../src/modules/22-bank-worker/bank-download.service'
import type { BankSessionService } from '../../../src/modules/22-bank-worker/bank-session.service'
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
  const session = {
    endSession: jest.fn().mockResolvedValue(undefined),
    listAccounts: jest.fn().mockResolvedValue({
      credential_id: 'cred',
      portal: 'Chase Bank',
      today: '06-15-2026',
      timezone: 'America/Chicago',
      accounts: [
        { mask: '7011', type: 'checking', name: 'x' },
        { mask: '7011', type: 'checking', name: 'dup' }, // dedupe
      ],
    }),
  } as unknown as jest.Mocked<BankSessionService>
  return { service, session, proc: new BankDownloadProcessor(service, session) }
}

describe('BankDownloadProcessor', () => {
  it('CR-bw-q-001: kind=checks → downloadChecks(clientId, dto, userId, onProgress)', async () => {
    const { service, session, proc } = build()
    const dto = { credentialId: 'cred', accountMasks: ['9027'] } as never
    const job = fakeJob({ kind: 'checks', clientId: 'c1', userId: 'u1', dto })

    const res = await proc.process(job)

    expect(service.downloadChecks).toHaveBeenCalledWith('c1', dto, 'u1', expect.any(Function))
    expect(res).toEqual({ ok: 'checks' })
    // v0.26.0: tras la extracción se desloguea + cierra la pestaña.
    expect(session.endSession).toHaveBeenCalledWith('c1', 'cred', 'u1')
  })

  it('CR-bw-q-005: kind=client-download → login + masks deduplicadas + download + logout', async () => {
    const { service, session, proc } = build()
    const credId = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb'
    const job = fakeJob({
      kind: 'client-download',
      what: 'statements',
      clientId: 'c1',
      credentialId: credId,
      userId: 'u1',
      accounts: 'all',
      params: { latest: true },
    } as never)

    const res = await proc.process(job)

    expect(session.listAccounts).toHaveBeenCalledWith('c1', credId, 'u1')
    expect(service.downloadStatements).toHaveBeenCalledWith(
      'c1',
      // D-mapi-BW-033: el verbo guarda por default (save:true) sin pedirlo.
      expect.objectContaining({
        credentialId: credId,
        accountMasks: ['7011'],
        latest: true,
        save: true,
      }),
      'u1',
      expect.any(Function),
    )
    expect(session.endSession).toHaveBeenCalledWith('c1', credId, 'u1')
    expect(res).toEqual({ ok: 'statements' })
  })

  it('CR-bw-q-006: client-download respeta save:false explícito (modo preview)', async () => {
    const { service, proc } = build()
    const credId = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb'
    const job = fakeJob({
      kind: 'client-download',
      what: 'statements',
      clientId: 'c1',
      credentialId: credId,
      userId: 'u1',
      accounts: 'all',
      params: { latest: true, save: false },
    } as never)

    await proc.process(job)

    expect(service.downloadStatements).toHaveBeenCalledWith(
      'c1',
      expect.objectContaining({ save: false }),
      'u1',
      expect.any(Function),
    )
  })

  it('CR-bw-q-004: endSession corre aunque la descarga falle (finally), sin tapar el error', async () => {
    const { service, session, proc } = build()
    ;(service.downloadChecks as jest.Mock).mockRejectedValue(new Error('tab stale'))
    const dto = { credentialId: 'cred', accountMasks: ['9027'] } as never
    const job = fakeJob({ kind: 'checks', clientId: 'c1', userId: 'u1', dto })

    await expect(proc.process(job)).rejects.toThrow('tab stale')
    expect(session.endSession).toHaveBeenCalledWith('c1', 'cred', 'u1')
  })

  it('CR-bw-q-003: el callback de progreso del worker llega a job.updateProgress (objeto)', async () => {
    const { service, proc } = build()
    // El service mock invoca su 4º arg (onProgress) con un objeto de progreso.
    const progress = {
      stage: 'checks',
      account: '9027',
      accountIndex: 1,
      accountTotal: 1,
      done: 3,
      total: 8,
    }
    ;(service.downloadChecks as jest.Mock).mockImplementation(
      async (_c: string, _d: unknown, _u: string, onProgress?: (p: unknown) => Promise<void>) => {
        await onProgress?.(progress)
        return { ok: 'checks' }
      },
    )
    const job = fakeJob({ kind: 'checks', clientId: 'c1', userId: 'u1', dto: {} as never })

    await proc.process(job)

    expect(job.updateProgress).toHaveBeenCalledWith(progress)
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
