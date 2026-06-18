import { Inject, Injectable } from '@nestjs/common'
import { BRIDGE_COMMAND_PORT, type BridgeCommandPort } from '@/contracts/bridge.port'
import type { BankFetchExecutor, BankFetchRequest, FetchResult } from './bank-fetch.types'

/**
 * Implementación real de `BankFetchExecutor` sobre el bridge: cada `fetch` del
 * adapter se manda al plugin (kiro) como `execute_fetch` (vía el
 * `BRIDGE_COMMAND_PORT` del core) y kiro lo ejecuta en la sesión viva del banco.
 *
 * No traduce ni interpreta nada del banco — solo despacha. El puerto ya lanza
 * `BridgeNotConnectedError` / `BridgeCommandTimeoutError`; se propagan al caller.
 */
@Injectable()
export class BridgeFetchExecutor implements BankFetchExecutor {
  constructor(@Inject(BRIDGE_COMMAND_PORT) private readonly bridge: BridgeCommandPort) {}

  async fetch(req: BankFetchRequest): Promise<FetchResult> {
    const result = await this.bridge.send({
      type: 'execute_fetch',
      payload: { method: req.method, url: req.url, headers: req.headers, body: req.body },
    })
    return result as FetchResult
  }
}
