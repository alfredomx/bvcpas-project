import { Inject, Injectable } from '@nestjs/common'
import { BRIDGE_COMMAND_PORT, type BridgeCommandPort } from '@/contracts/bridge.port'
import type { BankFetchExecutor, BankFetchRequest, FetchResult } from './bank-fetch.types'

/** Espera para que la pestaña recién abierta cargue y herede la sesión del banco. */
const SAME_ORIGIN_TAB_SETTLE_MS = 2500

/**
 * Implementación real de `BankFetchExecutor` sobre el bridge: cada `fetch` del
 * adapter se manda al plugin (kiro) como `execute_fetch` (vía el
 * `BRIDGE_COMMAND_PORT` del core) y kiro lo ejecuta en la sesión viva del banco.
 *
 * **Same-origin (D-bank-down-008):** kiro corre el fetch en una pestaña del MISMO
 * origen (usa su sesión/cookies). Si no hay pestaña en ese origen (ej. el endpoint
 * de documentos de Chase vive en `secure.chase.com` pero la sesión viva quedó en
 * `secure01a.chase.com`), kiro responde con `error` "sin pestaña same-origin";
 * abrimos una al origen del fetch (cookies de `.chase.com` aplican por dominio) y
 * reintentamos UNA vez. Cualquier otro error se devuelve tal cual.
 */
@Injectable()
export class BridgeFetchExecutor implements BankFetchExecutor {
  /** Espera tras abrir la pestaña. Sobrescribible en tests (instantáneo). */
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms))

  constructor(@Inject(BRIDGE_COMMAND_PORT) private readonly bridge: BridgeCommandPort) {}

  async fetch(req: BankFetchRequest): Promise<FetchResult> {
    const first = await this.execute(req)
    if (!needsSameOriginTab(first)) return first

    // Abre una pestaña al origen del fetch y reintenta una vez.
    await this.bridge.send({ type: 'open_tab', payload: { url: `${new URL(req.url).origin}/` } })
    await this.sleep(SAME_ORIGIN_TAB_SETTLE_MS)
    return this.execute(req)
  }

  private async execute(req: BankFetchRequest): Promise<FetchResult> {
    const result = await this.bridge.send({
      type: 'execute_fetch',
      payload: { method: req.method, url: req.url, headers: req.headers, body: req.body },
    })
    return result as FetchResult
  }
}

/** ¿El fallo es por no haber una pestaña del mismo origen abierta? */
function needsSameOriginTab(result: FetchResult): boolean {
  return !result.ok && typeof result.error === 'string' && /same-origin/i.test(result.error)
}
