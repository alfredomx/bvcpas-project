import { Inject, Injectable, Logger } from '@nestjs/common'
import { BANK_CREDENTIALS_PORT, type BankCredentialsPort } from '@/contracts/bank-credentials.port'
import {
  BRIDGE_COMMAND_PORT,
  type BridgeCommandPort,
  type ListTabsResult,
  type OpenTabResult,
} from '@/contracts/bridge.port'
import { ClientsService } from '@/modules/11-clients/clients.service'
import { BridgeFetchExecutor } from './adapters/bridge-fetch-executor'
import { getAdapterFactory } from './adapters/adapter-registry'
import { resolveToday } from './date-range.util'
import type { BankAccount, BankAdapter } from './adapters/bank-adapter.base'
import {
  BankAdapterNotSupportedError,
  BankLoginNotSupportedError,
  BankSessionNotEstablishedError,
} from './bank-download.errors'
import type { ListAccountsResponse } from './dto/bank-download.dto'

/** Intentos y espera para confirmar la sesión tras el login (afinar en vivo). */
const SESSION_POLL_ATTEMPTS = 5
const SESSION_POLL_DELAY_MS = 2000

/** Espera tras el click de "Sign out" antes de cerrar la pestaña (deja settle al logout). */
const LOGOUT_SETTLE_MS = 1500

/**
 * Orquesta la sesión del banco para listar cuentas EN VIVO (Design B). Fast path
 * si ya hay sesión; si no, arma la receta de login del adapter (creds del
 * `BANK_CREDENTIALS_PORT`), abre/ubica la pestaña del logonbox y manda la receta
 * por `execute_dom`, poll-eando hasta que la sesión queda viva. kiro sigue tonto.
 */
@Injectable()
export class BankSessionService {
  private readonly logger = new Logger(BankSessionService.name)

  /** Espera entre intentos. Sobrescribible en tests (instantáneo). */
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms))

  constructor(
    @Inject(BANK_CREDENTIALS_PORT) private readonly creds: BankCredentialsPort,
    @Inject(BRIDGE_COMMAND_PORT) private readonly bridge: BridgeCommandPort,
    private readonly clients: ClientsService,
    private readonly executor: BridgeFetchExecutor,
  ) {}

  async listAccounts(credentialId: string): Promise<ListAccountsResponse> {
    const cred = await this.creds.getDecrypted(credentialId)
    const factory = getAdapterFactory(cred.portalName)
    if (!factory) throw new BankAdapterNotSupportedError(cred.portalName)
    const adapter = factory(this.executor)

    const accounts = await this.ensureSessionAndGetAccounts(adapter, cred.portalName, {
      username: cred.username ?? '',
      password: cred.password ?? '',
      securityQa: cred.securityQa,
    })

    const client = await this.clients.getById(cred.clientId)
    const { today, timezone } = resolveToday(client.timezone)

    return {
      credential_id: cred.id,
      portal: cred.portalName,
      today,
      timezone,
      accounts: accounts.map((a) => ({ mask: a.mask, type: a.type, name: a.name ?? null })),
    }
  }

  /** Fast path (sesión viva) o login + poll hasta que la sesión responda. */
  private async ensureSessionAndGetAccounts(
    adapter: BankAdapter,
    portalName: string,
    creds: { username: string; password: string; securityQa: string | null },
  ): Promise<BankAccount[]> {
    try {
      return await adapter.getAllAccounts()
    } catch {
      // Sin sesión viva → login.
    }

    if (!adapter.buildLoginRecipe) throw new BankLoginNotSupportedError(portalName)
    const recipe = adapter.buildLoginRecipe(creds)

    const tabId = await this.ensureTab(recipe.url)
    await this.bridge.send({ type: 'execute_dom', payload: { tabId, steps: recipe.steps } })

    for (let attempt = 0; attempt < SESSION_POLL_ATTEMPTS; attempt++) {
      try {
        return await adapter.getAllAccounts()
      } catch {
        if (attempt < SESSION_POLL_ATTEMPTS - 1) await this.sleep(SESSION_POLL_DELAY_MS)
      }
    }
    throw new BankSessionNotEstablishedError(portalName)
  }

  /**
   * Asegura una pestaña EN LA URL DE LA RECETA (el logon), no solo en el mismo
   * host. Reusar por host dejaba la pestaña en otra ruta del banco (ej. el
   * dashboard), donde el form de login no es el mismo y el `fill` no encuentra los
   * campos. Reusa solo si ya está en `url` exacta; si hay una del mismo host en
   * otra ruta, la cierra y abre una fresca (no hay comando `navigate` en el
   * bridge). Solo se llama cuando NO hay sesión viva (login en frío).
   */
  private async ensureTab(url: string): Promise<number> {
    const tabs = (await this.bridge.send({ type: 'list_tabs' })) as ListTabsResult
    const exact = tabs.tabs.find((t) => t.url === url)
    if (exact) return exact.tabId

    const host = safeHost(url)
    const stale = tabs.tabs.find((t) => t.url !== undefined && safeHost(t.url) === host)
    if (stale) await this.bridge.send({ type: 'close_tab', payload: { tabId: stale.tabId } })

    const opened = (await this.bridge.send({ type: 'open_tab', payload: { url } })) as OpenTabResult
    return opened.tabId
  }

  /** tabId de una pestaña cuyo host coincide con el de `url`, o null si no hay. */
  private async findTabByHost(url: string): Promise<number | null> {
    const host = new URL(url).host
    const tabs = (await this.bridge.send({ type: 'list_tabs' })) as ListTabsResult
    const existing = tabs.tabs.find((t) => t.url !== undefined && safeHost(t.url) === host)
    return existing ? existing.tabId : null
  }

  /**
   * Cierra la sesión del banco tras una extracción: desloguea el portal (receta
   * DOM → click "Sign out") y cierra la pestaña. **Best-effort**: nunca lanza
   * (no enmascara el resultado de la descarga; el job ya terminó).
   */
  async endSession(credentialId: string): Promise<void> {
    try {
      const cred = await this.creds.getDecrypted(credentialId)
      const factory = getAdapterFactory(cred.portalName)
      if (!factory) return
      const adapter = factory(this.executor)
      if (!adapter.buildLogoutRecipe) return
      const recipe = adapter.buildLogoutRecipe()

      const tabId = await this.findTabByHost(recipe.url)
      if (tabId === null) return // Pestaña ya cerrada: nada que desloguear.

      await this.bridge.send({ type: 'execute_dom', payload: { tabId, steps: recipe.steps } })
      await this.sleep(LOGOUT_SETTLE_MS)
      await this.bridge.send({ type: 'close_tab', payload: { tabId } })
    } catch (err) {
      this.logger.warn(
        `endSession best-effort falló (cred ${credentialId}): ${
          err instanceof Error ? err.message : String(err)
        }`,
      )
    }
  }
}

/** Host de una URL, o '' si es inválida (no rompe el filtro de pestañas). */
function safeHost(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return ''
  }
}
