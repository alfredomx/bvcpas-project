import { Injectable } from '@nestjs/common'
import { BridgeCommandService } from '../../23-plugin-bridge/bridge-command.service'
import type { BankFetchExecutor, BankFetchRequest, FetchResult } from './bank-fetch.types'

/**
 * Implementación real de `BankFetchExecutor` sobre el bridge WS: cada `fetch`
 * del adapter se manda al plugin (kiro) como `execute_fetch` y kiro lo ejecuta
 * en la sesión viva del banco.
 *
 * No traduce ni interpreta nada del banco — solo despacha. `BridgeCommandService`
 * ya lanza `BridgeNotConnectedError` (no hay plugin) y `BridgeCommandTimeoutError`
 * (el plugin no respondió); esos errores se propagan tal cual al caller.
 */
@Injectable()
export class BridgeFetchExecutor implements BankFetchExecutor {
  constructor(private readonly bridge: BridgeCommandService) {}

  async fetch(req: BankFetchRequest): Promise<FetchResult> {
    const result = await this.bridge.send({
      type: 'execute_fetch',
      payload: { method: req.method, url: req.url, headers: req.headers, body: req.body },
    })
    return result as FetchResult
  }
}
