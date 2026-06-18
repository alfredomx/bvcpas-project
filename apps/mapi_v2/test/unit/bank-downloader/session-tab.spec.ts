import { BankSessionService } from '@plugins/bank-downloader/src/bank-session.service'
import { getAdapterFactory } from '@plugins/bank-downloader/src/adapters/adapter-registry'
import type { BankCredentialsPort } from '@/contracts/bank-credentials.port'
import type { BridgeCommandPort, BridgeCommand } from '@/contracts/bridge.port'
import type { ClientsService } from '@/modules/11-clients/clients.service'
import type { BridgeFetchExecutor } from '@plugins/bank-downloader/src/adapters/bridge-fetch-executor'
import type { BankAdapter } from '@plugins/bank-downloader/src/adapters/bank-adapter.base'

jest.mock('@plugins/bank-downloader/src/adapters/adapter-registry')
const mockedGetFactory = getAdapterFactory as jest.MockedFunction<typeof getAdapterFactory>

const LOGON = 'https://secure.chase.com/web/auth/#/logon/logon/chaseOnline'
const STALE_DASHBOARD = 'https://secure.chase.com/web/auth/dashboard#/dashboard/overview'

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
  getById: jest.fn().mockResolvedValue({ legalName: 'Bilia', timezone: 'America/Chicago' }),
} as unknown as ClientsService

const executor = {} as unknown as BridgeFetchExecutor

/** Adapter falso: getAllAccounts falla primero (sin sesión) y pasa tras el login. */
function fakeAdapter(): BankAdapter {
  const getAllAccounts = jest
    .fn()
    .mockRejectedValueOnce(new Error('sin sesión'))
    .mockResolvedValue([{ id: 'a1', mask: '3703', type: 'checking', name: 'marale' }])
  return {
    getAllAccounts,
    buildLoginRecipe: jest.fn().mockReturnValue({
      url: LOGON,
      steps: [{ op: 'fill', selector: '#x', value: 'y' }],
    }),
  } as unknown as BankAdapter
}

/** bridge.send que responde según el tipo de comando + registra las llamadas. */
function makeBridge(tabs: { tabId: number; url: string }[]): {
  bridge: BridgeCommandPort
  send: jest.Mock
} {
  const send = jest.fn(async (cmd: BridgeCommand) => {
    switch (cmd.type) {
      case 'list_tabs':
        return { tabs }
      case 'close_tab':
        return { closed: true }
      case 'open_tab':
        return { tabId: 99, url: cmd.payload.url }
      case 'execute_dom':
        return { requestId: 'r', ok: true, results: [] }
      default:
        return {}
    }
  })
  return { bridge: { send, isPluginConnected: () => true } as unknown as BridgeCommandPort, send }
}

function service(bridge: BridgeCommandPort): BankSessionService {
  mockedGetFactory.mockReturnValue(() => fakeAdapter())
  const svc = new BankSessionService(creds, bridge, clients, executor)
  svc.sleep = () => Promise.resolve() // poll instantáneo
  return svc
}

describe('BankSessionService.ensureTab (login en frío)', () => {
  it('cierra la pestaña stale del mismo host en otra ruta y abre fresca en la URL del logon', async () => {
    const { bridge, send } = makeBridge([{ tabId: 1, url: STALE_DASHBOARD }])
    await service(bridge).listAccounts('cr1')

    const types = send.mock.calls.map((c) => (c[0] as BridgeCommand).type)
    expect(types).toContain('close_tab')
    expect(send).toHaveBeenCalledWith({ type: 'close_tab', payload: { tabId: 1 } })
    expect(send).toHaveBeenCalledWith({ type: 'open_tab', payload: { url: LOGON } })
    // el execute_dom corre sobre la pestaña FRESCA (99), no sobre la stale (1)
    const dom = send.mock.calls.map((c) => c[0] as BridgeCommand).find((c) => c.type === 'execute_dom')
    expect(dom).toMatchObject({ payload: { tabId: 99 } })
  })

  it('reusa la pestaña si ya está EN la URL exacta del logon (no abre otra)', async () => {
    const { bridge, send } = makeBridge([{ tabId: 7, url: LOGON }])
    await service(bridge).listAccounts('cr1')

    const types = send.mock.calls.map((c) => (c[0] as BridgeCommand).type)
    expect(types).not.toContain('close_tab')
    expect(types).not.toContain('open_tab')
    const dom = send.mock.calls.map((c) => c[0] as BridgeCommand).find((c) => c.type === 'execute_dom')
    expect(dom).toMatchObject({ payload: { tabId: 7 } })
  })
})
