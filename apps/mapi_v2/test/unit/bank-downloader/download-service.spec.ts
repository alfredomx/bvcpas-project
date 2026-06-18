import { BankDownloadService } from '@plugins/bank-downloader/src/bank-download.service'
import { getAdapterFactory } from '@plugins/bank-downloader/src/adapters/adapter-registry'
import type { BankCredentialsPort } from '@/contracts/bank-credentials.port'
import type { ClientsService } from '@/modules/11-clients/clients.service'
import type { BridgeFetchExecutor } from '@plugins/bank-downloader/src/adapters/bridge-fetch-executor'
import type { BankAdapter, BankTxn } from '@plugins/bank-downloader/src/adapters/bank-adapter.base'
import type { ListActivityDto } from '@plugins/bank-downloader/src/dto/bank-download.dto'

jest.mock('@plugins/bank-downloader/src/adapters/adapter-registry')

const mockedGetFactory = getAdapterFactory as jest.MockedFunction<typeof getAdapterFactory>

const creds = {
  getDecrypted: jest.fn().mockResolvedValue({
    id: 'cr1',
    clientId: 'c1',
    bankPortalId: 'p1',
    portalName: 'Chase',
    username: 'user',
    password: 'pass',
    securityQa: null,
    status: 'active',
  }),
} as unknown as BankCredentialsPort

const clients = {
  getById: jest.fn().mockResolvedValue({ legalName: 'Bilia Eatery', timezone: 'America/Chicago' }),
} as unknown as ClientsService

const executor = {} as unknown as BridgeFetchExecutor

/** Adapter falso controlable por test (Design B: el service solo orquesta primitivas). */
function fakeAdapter(over: Partial<BankAdapter> = {}): BankAdapter {
  return {
    getAllAccounts: jest.fn(),
    searchTransactions: jest.fn().mockResolvedValue([]),
    getDepositDetails: jest.fn(),
    downloadImage: jest.fn().mockResolvedValue({ front: 'AAAA', rear: undefined }),
    listStatements: jest.fn().mockResolvedValue([]),
    downloadStatementPdf: jest.fn(),
    exportTransactions: jest.fn(),
    ...over,
  } as unknown as BankAdapter
}

function txn(over: Partial<BankTxn> = {}): BankTxn {
  return { sequenceNumber: 's1', date: '20260110', amount: 100, checkNumber: '111', ...over }
}

function service(adapter: BankAdapter): BankDownloadService {
  mockedGetFactory.mockReturnValue(() => adapter)
  return new BankDownloadService(creds, clients, executor)
}

const RANGE = { from: '01-01-2026', to: '01-31-2026' }

describe('BankDownloadService.downloadChecks', () => {
  it('descarga 1 cheque por mask y ensambla el total', async () => {
    const adapter = fakeAdapter({
      searchTransactions: jest.fn().mockResolvedValue([txn()]),
    })
    const res = await service(adapter).downloadChecks({
      credentialId: 'cr1',
      accountMasks: ['9027', '5799'],
      ...RANGE,
    })

    expect(res.credential_id).toBe('cr1')
    expect(res.portal).toBe('Chase')
    expect(res.range).toEqual({ from: '01-01-2026', to: '01-31-2026' })
    expect(res.total_checks).toBe(2)
    expect(res.accounts).toHaveLength(2)
    expect(res.accounts[0]).toMatchObject({ account_mask: '9027', count: 1 })
    expect(res.saved_dir).toBeNull()
  })

  it('PROPAGA si searchTransactions falla (sesión/bridge): el job no se disfraza de 0', async () => {
    const adapter = fakeAdapter({
      searchTransactions: jest.fn().mockRejectedValue(new Error('BRIDGE_NOT_CONNECTED')),
    })
    await expect(
      service(adapter).downloadChecks({
        credentialId: 'cr1',
        accountMasks: ['9027'],
        ...RANGE,
      }),
    ).rejects.toThrow('BRIDGE_NOT_CONNECTED')
  })

  it('aísla solo por-imagen: una imagen que falla se salta, el resto sigue', async () => {
    const downloadImage = jest
      .fn()
      .mockRejectedValueOnce(new Error('img 404')) // 1er cheque sin imagen
      .mockResolvedValueOnce({ front: 'AAAA', rear: undefined }) // 2º ok
    const adapter = fakeAdapter({
      searchTransactions: jest.fn().mockResolvedValue([txn(), txn({ sequenceNumber: 's2' })]),
      downloadImage,
    })
    const res = await service(adapter).downloadChecks({
      credentialId: 'cr1',
      accountMasks: ['9027'],
      ...RANGE,
    })

    // 2 txns, 1 imagen falló → 1 cheque ensamblado; el job completa (no lanza).
    expect(res.total_checks).toBe(1)
    expect(res.accounts[0]).toMatchObject({ account_mask: '9027', count: 1 })
  })
})

describe('BankDownloadService.listChecks', () => {
  it('preview de actividad sin descargar imágenes', async () => {
    const downloadImage = jest.fn()
    const adapter = fakeAdapter({
      searchTransactions: jest.fn().mockResolvedValue([txn(), txn({ sequenceNumber: 's2' })]),
      downloadImage,
    })
    const dto: ListActivityDto = { credentialId: 'cr1', accountMasks: ['9027'], ...RANGE }
    const res = await service(adapter).listChecks(dto)

    expect(res.total).toBe(2)
    expect(res.accounts[0]).toMatchObject({ account_mask: '9027', count: 2 })
    expect(downloadImage).not.toHaveBeenCalled()
  })
})
