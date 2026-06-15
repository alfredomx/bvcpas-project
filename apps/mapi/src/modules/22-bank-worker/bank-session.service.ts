import { Injectable, Logger } from '@nestjs/common'
import { ClientsRepository } from '../11-clients/clients.repository'
import { EncryptionService } from '../../core/encryption/encryption.service'
import { EventLogService } from '../95-event-log/event-log.service'
import { BridgeCommandService } from '../23-plugin-bridge/bridge-command.service'
import type { ListTabsResult, OpenTabResult } from '../23-plugin-bridge/bridge.types'
import { BankPortalsRepository } from './bank-portals.repository'
import { ClientBankAccountsRepository } from './client-bank-accounts.repository'
import { BridgeFetchExecutor } from './adapters/bridge-fetch-executor'
import { getAdapterFactory } from './adapters/adapter-registry'
import { resolveToday } from './date-range.util'
import type { BankAccount, BankAdapter, BankLoginCredentials } from './adapters/bank-adapter.base'
import type { ClientBankAccount } from '../../db/schema/client-bank-accounts'
import type { BankPortal } from '../../db/schema/bank-portals'
import {
  BankAdapterNotSupportedError,
  BankLoginNotSupportedError,
  BankPortalNotFoundError,
  BankSessionNotEstablishedError,
  ClientBankAccountNotFoundError,
} from './bank-worker.errors'
import type { ListAccountsResponse } from './dto/bank-download.dto'

/** Intentos y espera para confirmar la sesión tras el login (afinar en vivo). */
const SESSION_POLL_ATTEMPTS = 5
const SESSION_POLL_DELAY_MS = 2000

/**
 * Orquesta la sesión del banco para listar cuentas EN VIVO (v0.21.0, Fase 4).
 *
 * `listAccounts(clientId, credentialId)`:
 *  1. Fast path: si ya hay sesión, `getAllAccounts()` responde → se usa tal cual
 *     (cubre "ya hay pestaña logueada de Chase").
 *  2. Si no hay sesión: arma la receta de login del adapter (desde vault, creds
 *     descifradas), abre/ubica la pestaña del logonbox (`list_tabs`/`open_tab`),
 *     manda la receta por `execute_dom`, y poll-ea `getAllAccounts()` hasta que
 *     la sesión queda viva.
 *
 * Las cuentas NO vienen de vault (el operador no las registra): salen del banco
 * en vivo. Devuelve también el ancla `today` (zona del cliente) para que el
 * conector traduzca rangos libres a `from`/`to`.
 *
 * Design B: kiro sigue tonto — recibe `open_tab`/`execute_dom` como data. Los
 * selectores y la URL del logonbox viven en el adapter (mapi).
 */
@Injectable()
export class BankSessionService {
  private readonly logger = new Logger(BankSessionService.name)

  /** Espera entre intentos. Sobrescribible en tests (instantáneo). */
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms))

  constructor(
    private readonly credsRepo: ClientBankAccountsRepository,
    private readonly portalsRepo: BankPortalsRepository,
    private readonly clientsRepo: ClientsRepository,
    private readonly encryption: EncryptionService,
    private readonly executor: BridgeFetchExecutor,
    private readonly bridge: BridgeCommandService,
    private readonly events: EventLogService,
  ) {}

  async listAccounts(
    clientId: string,
    credentialId: string,
    userId: string,
  ): Promise<ListAccountsResponse> {
    const cred = await this.credsRepo.findById(credentialId, clientId)
    if (!cred) throw new ClientBankAccountNotFoundError(credentialId)

    const portal = await this.portalsRepo.findById(cred.bankPortalId)
    if (!portal) throw new BankPortalNotFoundError(cred.bankPortalId)

    const factory = getAdapterFactory(portal.name)
    if (!factory) throw new BankAdapterNotSupportedError(portal.name)
    const adapter = factory(this.executor)

    const accounts = await this.ensureSessionAndGetAccounts(adapter, cred, portal)

    const client = await this.clientsRepo.findById(clientId)
    const { today, timezone } = resolveToday(client?.timezone ?? null)

    await this.events.log(
      'bank.session.accounts_listed',
      {
        client_bank_account_id: cred.id,
        client_id: clientId,
        portal: portal.name,
        account_count: accounts.length,
      },
      userId,
      { type: 'client_bank_account', id: cred.id },
    )

    return {
      credential_id: cred.id,
      portal: portal.name,
      today,
      timezone,
      accounts: accounts.map((a) => ({ mask: a.mask, type: a.type, name: a.name ?? null })),
    }
  }

  /** Fast path (sesión viva) o login + poll hasta que la sesión responda. */
  private async ensureSessionAndGetAccounts(
    adapter: BankAdapter,
    cred: ClientBankAccount,
    portal: BankPortal,
  ): Promise<BankAccount[]> {
    try {
      return await adapter.getAllAccounts()
    } catch {
      // Sin sesión viva → login.
    }

    if (!adapter.buildLoginRecipe) throw new BankLoginNotSupportedError(portal.name)
    const recipe = adapter.buildLoginRecipe(this.decryptCreds(cred))

    const tabId = await this.ensureTab(recipe.url)
    await this.bridge.send({ type: 'execute_dom', payload: { tabId, steps: recipe.steps } })

    // El banco tarda en establecer la sesión tras el submit: poll getAllAccounts.
    for (let attempt = 0; attempt < SESSION_POLL_ATTEMPTS; attempt++) {
      try {
        return await adapter.getAllAccounts()
      } catch {
        if (attempt < SESSION_POLL_ATTEMPTS - 1) await this.sleep(SESSION_POLL_DELAY_MS)
      }
    }
    throw new BankSessionNotEstablishedError(portal.name)
  }

  /** Usa la pestaña del host del logonbox si ya existe; si no, abre una nueva. */
  private async ensureTab(url: string): Promise<number> {
    const host = new URL(url).host
    const tabs = (await this.bridge.send({ type: 'list_tabs' })) as ListTabsResult
    const existing = tabs.tabs.find((t) => t.url !== undefined && safeHost(t.url) === host)
    if (existing) return existing.tabId

    const opened = (await this.bridge.send({ type: 'open_tab', payload: { url } })) as OpenTabResult
    return opened.tabId
  }

  private decryptCreds(cred: ClientBankAccount): BankLoginCredentials {
    if (!cred.usernameEncrypted || !cred.passwordEncrypted) {
      this.logger.warn(`Credencial ${cred.id} sin usuario/password — no se puede auto-loguear`)
    }
    return {
      username: cred.usernameEncrypted ? this.encryption.decrypt(cred.usernameEncrypted) : '',
      password: cred.passwordEncrypted ? this.encryption.decrypt(cred.passwordEncrypted) : '',
      securityQa: cred.securityQaEncrypted
        ? this.encryption.decrypt(cred.securityQaEncrypted)
        : null,
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
