import { BankSessionService } from '../../../src/modules/22-bank-worker/bank-session.service'
import { getAdapterFactory } from '../../../src/modules/22-bank-worker/adapters/adapter-registry'
import type { ClientBankAccountsRepository } from '../../../src/modules/22-bank-worker/client-bank-accounts.repository'
import type { BankPortalsRepository } from '../../../src/modules/22-bank-worker/bank-portals.repository'
import type { ClientsRepository } from '../../../src/modules/11-clients/clients.repository'
import type { EncryptionService } from '../../../src/core/encryption/encryption.service'
import type { BridgeFetchExecutor } from '../../../src/modules/22-bank-worker/adapters/bridge-fetch-executor'
import type { BridgeCommandService } from '../../../src/modules/23-plugin-bridge/bridge-command.service'
import type { EventLogService } from '../../../src/modules/95-event-log/event-log.service'
import type { BankAdapter } from '../../../src/modules/22-bank-worker/adapters/bank-adapter.base'
import type { ClientBankAccount } from '../../../src/db/schema/client-bank-accounts'
import type { BankPortal } from '../../../src/db/schema/bank-portals'
import {
  BankLoginNotSupportedError,
  BankSessionNotEstablishedError,
  ClientBankAccountNotFoundError,
} from '../../../src/modules/22-bank-worker/bank-worker.errors'

jest.mock('../../../src/modules/22-bank-worker/adapters/adapter-registry')
const mockGetAdapterFactory = getAdapterFactory as jest.MockedFunction<typeof getAdapterFactory>

const NOW = new Date()
const CLIENT_ID = 'client-1'
const CRED_ID = 'cred-1'
const LOGON_URL = 'https://secure.chase.com/web/auth/#/logon/logon/chaseOnline'

const ACCOUNTS = [
  { id: '123', mask: '8250', type: 'checking', name: 'Operating' },
  { id: '456', mask: '9000', type: 'credit', name: 'Card' },
]

function credRow(over: Partial<ClientBankAccount> = {}): ClientBankAccount {
  return {
    id: CRED_ID,
    clientId: CLIENT_ID,
    bankPortalId: 'portal-1',
    nickname: null,
    usernameEncrypted: 'enc-user',
    passwordEncrypted: 'enc-pass',
    securityQaEncrypted: null,
    status: 'active',
    notes: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...over,
  }
}

function portalRow(over: Partial<BankPortal> = {}): BankPortal {
  return { id: 'portal-1', name: 'Chase', portalUrl: null, createdAt: NOW, updatedAt: NOW, ...over }
}

interface Mocks {
  credsRepo: jest.Mocked<ClientBankAccountsRepository>
  portalsRepo: jest.Mocked<BankPortalsRepository>
  clientsRepo: jest.Mocked<ClientsRepository>
  encryption: jest.Mocked<EncryptionService>
  executor: BridgeFetchExecutor
  bridge: { send: jest.Mock }
  events: { log: jest.Mock }
  getAllAccounts: jest.Mock
  buildLoginRecipe: jest.Mock
}

function makeMocks(opts: { withLogin?: boolean } = {}): Mocks {
  const getAllAccounts = jest.fn()
  const buildLoginRecipe = jest.fn(() => ({
    url: LOGON_URL,
    steps: [{ op: 'click', selector: '#signin-button' }],
  }))
  const adapter = {
    getAllAccounts,
    ...(opts.withLogin === false ? {} : { buildLoginRecipe }),
  } as unknown as BankAdapter
  mockGetAdapterFactory.mockReturnValue(() => adapter)

  return {
    credsRepo: {
      findById: jest.fn().mockResolvedValue(credRow()),
    } as unknown as jest.Mocked<ClientBankAccountsRepository>,
    portalsRepo: {
      findById: jest.fn().mockResolvedValue(portalRow()),
    } as unknown as jest.Mocked<BankPortalsRepository>,
    clientsRepo: {
      findById: jest.fn().mockResolvedValue({ timezone: 'America/Chicago' }),
    } as unknown as jest.Mocked<ClientsRepository>,
    encryption: {
      decrypt: jest.fn((s: string) => (s === 'enc-user' ? 'alfredo' : 'secret')),
    } as unknown as jest.Mocked<EncryptionService>,
    executor: { fetch: jest.fn() } as unknown as BridgeFetchExecutor,
    bridge: {
      send: jest.fn(async (cmd: { type: string; payload?: { url?: string } }) => {
        if (cmd.type === 'list_tabs') return { tabs: [] }
        if (cmd.type === 'open_tab') return { tabId: 99, url: cmd.payload?.url }
        return { requestId: 'd', ok: true, results: [] } // execute_dom
      }),
    },
    events: { log: jest.fn().mockResolvedValue(undefined) },
    getAllAccounts,
    buildLoginRecipe,
  }
}

function build(m: Mocks): BankSessionService {
  const svc = new BankSessionService(
    m.credsRepo,
    m.portalsRepo,
    m.clientsRepo,
    m.encryption,
    m.executor,
    m.bridge as unknown as BridgeCommandService,
    m.events as unknown as EventLogService,
  )
  svc.sleep = () => Promise.resolve() // sin esperas reales en tests
  return svc
}

beforeEach(() => mockGetAdapterFactory.mockReset())

describe('BankSessionService.listAccounts', () => {
  it('CR-bw-sess-001: fast path — sesión viva, lista cuentas sin login ni bridge', async () => {
    const m = makeMocks()
    m.getAllAccounts.mockResolvedValue(ACCOUNTS)

    const res = await build(m).listAccounts(CLIENT_ID, CRED_ID, 'user-1')

    expect(res).toMatchObject({
      credential_id: CRED_ID,
      portal: 'Chase',
      timezone: 'America/Chicago',
    })
    expect(res.today).toMatch(/^\d{2}-\d{2}-\d{4}$/)
    expect(res.accounts).toEqual([
      { mask: '8250', type: 'checking', name: 'Operating' },
      { mask: '9000', type: 'credit', name: 'Card' },
    ])
    expect(m.bridge.send).not.toHaveBeenCalled()
    expect(m.buildLoginRecipe).not.toHaveBeenCalled()
    expect(m.events.log).toHaveBeenCalledWith(
      'bank.session.accounts_listed',
      expect.objectContaining({ account_count: 2 }),
      'user-1',
      { type: 'client_bank_account', id: CRED_ID },
    )
  })

  it('CR-bw-sess-002: sin sesión y sin pestaña → open_tab + execute_dom + retry cuentas', async () => {
    const m = makeMocks()
    m.getAllAccounts.mockRejectedValueOnce(new Error('401')).mockResolvedValue(ACCOUNTS)

    const res = await build(m).listAccounts(CLIENT_ID, CRED_ID, 'user-1')

    expect(m.buildLoginRecipe).toHaveBeenCalledWith({
      username: 'alfredo',
      password: 'secret',
      securityQa: null,
    })
    const sent = m.bridge.send.mock.calls.map((c) => (c[0] as { type: string }).type)
    expect(sent).toEqual(['list_tabs', 'open_tab', 'execute_dom'])
    const openTab = m.bridge.send.mock.calls.find(
      (c) => (c[0] as { type: string }).type === 'open_tab',
    )
    expect((openTab![0] as { payload: { url: string } }).payload.url).toBe(LOGON_URL)
    const dom = m.bridge.send.mock.calls.find(
      (c) => (c[0] as { type: string }).type === 'execute_dom',
    )
    expect((dom![0] as { payload: { tabId: number } }).payload.tabId).toBe(99)
    expect(res.accounts).toHaveLength(2)
  })

  it('CR-bw-sess-003: sin sesión pero con pestaña del logonbox → NO open_tab, usa esa tab', async () => {
    const m = makeMocks()
    m.getAllAccounts.mockRejectedValueOnce(new Error('401')).mockResolvedValue(ACCOUNTS)
    m.bridge.send.mockImplementation(async (cmd: { type: string }) => {
      if (cmd.type === 'list_tabs') {
        return {
          tabs: [
            { tabId: 7, url: 'https://secure.chase.com/web/auth/x', active: true, windowId: 1 },
          ],
        }
      }
      return { requestId: 'd', ok: true, results: [] }
    })

    await build(m).listAccounts(CLIENT_ID, CRED_ID, 'user-1')

    const sent = m.bridge.send.mock.calls.map((c) => (c[0] as { type: string }).type)
    expect(sent).toContain('list_tabs')
    expect(sent).not.toContain('open_tab')
    const dom = m.bridge.send.mock.calls.find(
      (c) => (c[0] as { type: string }).type === 'execute_dom',
    )
    expect((dom![0] as { payload: { tabId: number } }).payload.tabId).toBe(7)
  })

  it('CR-bw-sess-004: credencial inexistente → ClientBankAccountNotFoundError', async () => {
    const m = makeMocks()
    m.credsRepo.findById.mockResolvedValue(null)
    await expect(build(m).listAccounts(CLIENT_ID, CRED_ID, 'user-1')).rejects.toBeInstanceOf(
      ClientBankAccountNotFoundError,
    )
  })

  it('CR-bw-sess-005: adapter sin login automatizado → BankLoginNotSupportedError', async () => {
    const m = makeMocks({ withLogin: false })
    m.getAllAccounts.mockRejectedValue(new Error('401'))
    await expect(build(m).listAccounts(CLIENT_ID, CRED_ID, 'user-1')).rejects.toBeInstanceOf(
      BankLoginNotSupportedError,
    )
  })

  it('CR-bw-sess-006: la sesión nunca responde tras login → BankSessionNotEstablishedError', async () => {
    const m = makeMocks()
    m.getAllAccounts.mockRejectedValue(new Error('401'))
    await expect(build(m).listAccounts(CLIENT_ID, CRED_ID, 'user-1')).rejects.toBeInstanceOf(
      BankSessionNotEstablishedError,
    )
  })
})
