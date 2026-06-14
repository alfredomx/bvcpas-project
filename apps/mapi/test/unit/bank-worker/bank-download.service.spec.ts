import { BankDownloadService } from '../../../src/modules/22-bank-worker/bank-download.service'
import { getAdapterFactory } from '../../../src/modules/22-bank-worker/adapters/adapter-registry'
import type { ClientBankAccountsRepository } from '../../../src/modules/22-bank-worker/client-bank-accounts.repository'
import type { GlobalCredentialRow } from '../../../src/modules/22-bank-worker/client-bank-accounts.repository'
import type { BankAccountsRepository } from '../../../src/modules/22-bank-worker/bank-accounts.repository'
import type { BankPortalsRepository } from '../../../src/modules/22-bank-worker/bank-portals.repository'
import type { ClientsRepository } from '../../../src/modules/11-clients/clients.repository'
import type { BridgeFetchExecutor } from '../../../src/modules/22-bank-worker/adapters/bridge-fetch-executor'
import type { EventLogService } from '../../../src/modules/95-event-log/event-log.service'
import type { BankAdapter } from '../../../src/modules/22-bank-worker/adapters/bank-adapter.base'
import type { DownloadedImage } from '../../../src/modules/22-bank-worker/adapters/chase.adapter'
import type { ClientBankAccount } from '../../../src/db/schema/client-bank-accounts'
import type { BankAccount } from '../../../src/db/schema/bank-accounts'
import type { BankPortal } from '../../../src/db/schema/bank-portals'
import type { DownloadChecksDto } from '../../../src/modules/22-bank-worker/dto/bank-download.dto'
import {
  BankAdapterNotSupportedError,
  BankPortalNotFoundError,
  ClientBankAccountNotFoundError,
} from '../../../src/modules/22-bank-worker/bank-worker.errors'

// El registry se mockea para inyectar un adapter stub (sin tocar la mecánica de Chase).
jest.mock('../../../src/modules/22-bank-worker/adapters/adapter-registry')
const mockGetAdapterFactory = getAdapterFactory as jest.MockedFunction<typeof getAdapterFactory>

const NOW = new Date()
const CLIENT_ID = 'client-1'
const CRED_ID = 'cred-1'

function credRow(overrides: Partial<ClientBankAccount> = {}): ClientBankAccount {
  return {
    id: CRED_ID,
    clientId: CLIENT_ID,
    bankPortalId: 'portal-1',
    nickname: 'Login principal',
    usernameEncrypted: 'enc-user',
    passwordEncrypted: 'enc-pass',
    securityQaEncrypted: null,
    status: 'active',
    notes: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}

function portalRow(overrides: Partial<BankPortal> = {}): BankPortal {
  return {
    id: 'portal-1',
    name: 'Chase',
    portalUrl: 'https://secure.chase.com',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}

function acct(overrides: Partial<BankAccount> = {}): BankAccount {
  return {
    id: 'acct-1',
    clientBankAccountId: CRED_ID,
    accountMask: '8250',
    accountType: 'checking',
    label: 'Operating',
    status: 'active',
    notes: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}

function globalRow(
  credential: ClientBankAccount,
  portal: { id: string; name: string; portal_url: string | null },
): GlobalCredentialRow {
  return {
    credential,
    client: { id: CLIENT_ID, legal_name: 'Arcmen Engineering' },
    portal,
  }
}

const CHECK: DownloadedImage = {
  sequenceNumber: 'C1',
  type: 'CHECK',
  frontImageBase64: 'FRONT64',
  rearImageBase64: 'REAR64',
}

interface Mocks {
  credsRepo: jest.Mocked<ClientBankAccountsRepository>
  accountsRepo: jest.Mocked<BankAccountsRepository>
  portalsRepo: jest.Mocked<BankPortalsRepository>
  clientsRepo: jest.Mocked<ClientsRepository>
  executor: BridgeFetchExecutor
  events: { log: jest.Mock }
  adapterDownloadChecks: jest.Mock
}

function makeMocks(): Mocks {
  const adapterDownloadChecks = jest.fn().mockResolvedValue([CHECK])
  const stubAdapter = { downloadChecks: adapterDownloadChecks } as unknown as BankAdapter
  mockGetAdapterFactory.mockReturnValue(() => stubAdapter)

  return {
    credsRepo: {
      findById: jest.fn(),
      listGlobalWithJoins: jest.fn(),
    } as unknown as jest.Mocked<ClientBankAccountsRepository>,
    accountsRepo: {
      listByCredential: jest.fn().mockResolvedValue([]),
      findByCredentialAndMask: jest.fn(),
    } as unknown as jest.Mocked<BankAccountsRepository>,
    portalsRepo: {
      findById: jest.fn().mockResolvedValue(portalRow()),
    } as unknown as jest.Mocked<BankPortalsRepository>,
    clientsRepo: {
      findById: jest.fn().mockResolvedValue({ timezone: 'America/Chicago' }),
    } as unknown as jest.Mocked<ClientsRepository>,
    executor: { fetch: jest.fn() } as unknown as BridgeFetchExecutor,
    events: { log: jest.fn().mockResolvedValue(undefined) },
    adapterDownloadChecks,
  }
}

function build(m: Mocks): BankDownloadService {
  return new BankDownloadService(
    m.credsRepo,
    m.accountsRepo,
    m.portalsRepo,
    m.clientsRepo,
    m.executor,
    m.events as unknown as EventLogService,
  )
}

beforeEach(() => {
  mockGetAdapterFactory.mockReset()
})

describe('BankDownloadService.listCredentials', () => {
  it('CR-bw-dl-001: lista credenciales con cuentas y download_supported, SIN secretos', async () => {
    const m = makeMocks()
    mockGetAdapterFactory.mockReturnValue(() => ({}) as unknown as BankAdapter)
    m.credsRepo.listGlobalWithJoins.mockResolvedValue({
      items: [globalRow(credRow(), { id: 'portal-1', name: 'Chase', portal_url: null })],
      total: 1,
    })
    m.accountsRepo.listByCredential.mockResolvedValue([
      acct({ id: 'a1', accountMask: '8250' }),
      acct({ id: 'a2', accountMask: '9000', accountType: 'savings' }),
    ])

    const { data } = await build(m).listCredentials(CLIENT_ID)

    expect(data).toHaveLength(1)
    expect(data[0]).toMatchObject({
      credential_id: CRED_ID,
      portal: { id: 'portal-1', name: 'Chase' },
      nickname: 'Login principal',
      status: 'active',
      download_supported: true,
    })
    expect(data[0].accounts.map((a) => a.mask)).toEqual(['8250', '9000'])
    // Nunca expone credenciales en claro ni el blob encriptado.
    expect(JSON.stringify(data)).not.toContain('username')
    expect(JSON.stringify(data)).not.toContain('password')
    expect(JSON.stringify(data)).not.toContain('enc-')
  })

  it('CR-bw-dl-002: filtra por portal (difuso, case-insensitive)', async () => {
    const m = makeMocks()
    mockGetAdapterFactory.mockReturnValue(() => ({}) as unknown as BankAdapter)
    m.credsRepo.listGlobalWithJoins.mockResolvedValue({
      items: [
        globalRow(credRow({ id: 'c-chase', bankPortalId: 'p-chase' }), {
          id: 'p-chase',
          name: 'Chase',
          portal_url: null,
        }),
        globalRow(credRow({ id: 'c-rbfcu', bankPortalId: 'p-rbfcu' }), {
          id: 'p-rbfcu',
          name: 'RBFCU',
          portal_url: null,
        }),
      ],
      total: 2,
    })

    const { data } = await build(m).listCredentials(CLIENT_ID, 'rbfcu')

    expect(data).toHaveLength(1)
    expect(data[0].portal.name).toBe('RBFCU')
  })

  it('CR-bw-dl-003: download_supported=false cuando el portal no tiene adapter', async () => {
    const m = makeMocks()
    mockGetAdapterFactory.mockReturnValue(null)
    m.credsRepo.listGlobalWithJoins.mockResolvedValue({
      items: [globalRow(credRow(), { id: 'portal-1', name: 'RBFCU', portal_url: null })],
      total: 1,
    })

    const { data } = await build(m).listCredentials(CLIENT_ID)

    expect(data[0].download_supported).toBe(false)
  })
})

describe('BankDownloadService.downloadChecks', () => {
  it('CR-bw-dl-004: descarga las masks dadas; fechas explícitas pasan al adapter', async () => {
    const m = makeMocks()
    m.credsRepo.findById.mockResolvedValue(credRow())

    const dto = {
      credentialId: CRED_ID,
      accountMasks: ['8250'],
      from: '03-01-2026',
      to: '03-31-2026',
    } as DownloadChecksDto
    const res = await build(m).downloadChecks(CLIENT_ID, dto, 'user-1')

    expect(m.adapterDownloadChecks).toHaveBeenCalledTimes(1)
    expect(m.adapterDownloadChecks).toHaveBeenCalledWith('8250', '03-01-2026', '03-31-2026')
    expect(res).toMatchObject({
      credential_id: CRED_ID,
      portal: 'Chase',
      range: { from: '03-01-2026', to: '03-31-2026' },
      total_checks: 1,
    })
    expect(res.accounts).toEqual([{ account_mask: '8250', count: 1, checks: [CHECK] }])
    expect(m.events.log).toHaveBeenCalledWith(
      'bank.checks.downloaded',
      expect.objectContaining({ total_checks: 1, account_masks: ['8250'] }),
      'user-1',
      { type: 'client_bank_account', id: CRED_ID },
    )
  })

  it('CR-bw-dl-005: itera TODAS las masks del array (todas las cuentas elegidas)', async () => {
    const m = makeMocks()
    m.credsRepo.findById.mockResolvedValue(credRow())

    const dto = {
      credentialId: CRED_ID,
      accountMasks: ['8250', '9000', '7777'],
      from: '01-01-2026',
      to: '01-31-2026',
    } as DownloadChecksDto
    const res = await build(m).downloadChecks(CLIENT_ID, dto, 'user-1')

    expect(m.adapterDownloadChecks).toHaveBeenCalledTimes(3)
    expect(res.accounts.map((a) => a.account_mask)).toEqual(['8250', '9000', '7777'])
    expect(res.total_checks).toBe(3)
  })

  it('CR-bw-dl-006: range preset se resuelve a MM-DD-YYYY (zona del cliente)', async () => {
    const m = makeMocks()
    m.credsRepo.findById.mockResolvedValue(credRow())

    const dto = {
      credentialId: CRED_ID,
      accountMasks: ['8250'],
      range: 'last_month',
    } as DownloadChecksDto
    const res = await build(m).downloadChecks(CLIENT_ID, dto, 'user-1')

    expect(res.range.from).toMatch(/^\d{2}-\d{2}-\d{4}$/)
    expect(res.range.to).toMatch(/^\d{2}-\d{2}-\d{4}$/)
    const [maskArg, fromArg, toArg] = m.adapterDownloadChecks.mock.calls[0]
    expect(maskArg).toBe('8250')
    expect(fromArg).toMatch(/^\d{2}-\d{2}-\d{4}$/)
    expect(toArg).toMatch(/^\d{2}-\d{2}-\d{4}$/)
  })

  it('CR-bw-dl-007: credencial inexistente → ClientBankAccountNotFoundError', async () => {
    const m = makeMocks()
    m.credsRepo.findById.mockResolvedValue(null)
    const dto = {
      credentialId: CRED_ID,
      accountMasks: ['8250'],
      range: 'today',
    } as DownloadChecksDto
    await expect(build(m).downloadChecks(CLIENT_ID, dto, 'user-1')).rejects.toBeInstanceOf(
      ClientBankAccountNotFoundError,
    )
  })

  it('CR-bw-dl-008: portal inexistente → BankPortalNotFoundError', async () => {
    const m = makeMocks()
    m.credsRepo.findById.mockResolvedValue(credRow())
    m.portalsRepo.findById.mockResolvedValue(null)
    const dto = {
      credentialId: CRED_ID,
      accountMasks: ['8250'],
      range: 'today',
    } as DownloadChecksDto
    await expect(build(m).downloadChecks(CLIENT_ID, dto, 'user-1')).rejects.toBeInstanceOf(
      BankPortalNotFoundError,
    )
  })

  it('CR-bw-dl-009: portal sin adapter → BankAdapterNotSupportedError', async () => {
    const m = makeMocks()
    mockGetAdapterFactory.mockReturnValue(null)
    m.credsRepo.findById.mockResolvedValue(credRow())
    m.portalsRepo.findById.mockResolvedValue(portalRow({ name: 'RBFCU' }))
    const dto = {
      credentialId: CRED_ID,
      accountMasks: ['8250'],
      range: 'today',
    } as DownloadChecksDto
    await expect(build(m).downloadChecks(CLIENT_ID, dto, 'user-1')).rejects.toBeInstanceOf(
      BankAdapterNotSupportedError,
    )
  })
})
