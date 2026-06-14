import { BridgeAdminController } from '../../../src/modules/23-plugin-bridge/bridge-admin.controller'
import type { BridgeCommandService } from '../../../src/modules/23-plugin-bridge/bridge-command.service'
import type { ExecuteDomDto } from '../../../src/modules/23-plugin-bridge/dto/bridge.dto'
import { ExecuteDomSchema } from '../../../src/modules/23-plugin-bridge/dto/bridge.dto'

/**
 * Tests Tipo A del BridgeAdminController (v0.20.0): delega en BridgeCommandService
 * (mockeado) con el comando correcto y devuelve el resultado tal cual. Sin WS, sin DB.
 */
function makeCommands(result: unknown): jest.Mocked<BridgeCommandService> {
  return { send: jest.fn(async () => result) } as unknown as jest.Mocked<BridgeCommandService>
}

describe('BridgeAdminController', () => {
  it('tabs() manda list_tabs y devuelve el resultado del plugin', async () => {
    const result = { tabs: [{ tabId: 7, active: true, windowId: 1 }] }
    const commands = makeCommands(result)
    const ctrl = new BridgeAdminController(commands)

    const res = await ctrl.tabs()

    expect(commands.send).toHaveBeenCalledWith({ type: 'list_tabs' })
    expect(res).toBe(result)
  })

  it('dom() manda execute_dom con { tabId, steps } y devuelve el DomResult', async () => {
    const domResult = { requestId: 'x', ok: true, results: [{ op: 'fill', ok: true }] }
    const commands = makeCommands(domResult)
    const ctrl = new BridgeAdminController(commands)

    const body = {
      tabId: 42,
      steps: [{ op: 'fill' as const, selector: '#u', value: 'a' }],
    } as unknown as ExecuteDomDto

    const res = await ctrl.dom(body)

    expect(commands.send).toHaveBeenCalledWith({
      type: 'execute_dom',
      payload: { tabId: 42, steps: body.steps },
    })
    expect(res).toBe(domResult)
  })
})

describe('ExecuteDomSchema', () => {
  it('acepta una receta válida (fill + click)', () => {
    const parsed = ExecuteDomSchema.parse({
      tabId: 1,
      steps: [
        { op: 'fill', selector: '#u', value: 'x' },
        { op: 'click', selector: '#b' },
      ],
    })
    expect(parsed.steps).toHaveLength(2)
  })

  it('rechaza tabId no entero, steps vacío, op desconocido o fill sin value', () => {
    expect(() =>
      ExecuteDomSchema.parse({ tabId: 1.5, steps: [{ op: 'click', selector: '#b' }] }),
    ).toThrow()
    expect(() => ExecuteDomSchema.parse({ tabId: 1, steps: [] })).toThrow()
    expect(() =>
      ExecuteDomSchema.parse({ tabId: 1, steps: [{ op: 'nope', selector: '#b' }] }),
    ).toThrow()
    expect(() =>
      ExecuteDomSchema.parse({ tabId: 1, steps: [{ op: 'fill', selector: '#u' }] }),
    ).toThrow()
  })
})
