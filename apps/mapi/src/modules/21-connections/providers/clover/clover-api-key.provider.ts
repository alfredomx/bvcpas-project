import { Inject, Injectable, Optional } from '@nestjs/common'
import type { DecryptedApiKeyConnection } from '../../../../db/schema/user-connections'
import { ConnectionAuthError, CredentialsShapeError } from '../../connection.errors'
import type { TestResult } from '../provider.interface'

export const CLOVER_FETCH = Symbol('CLOVER_FETCH')

const CLOVER_API_BASE = 'https://api.clover.com'

interface CloverMerchantResponse {
  id: string
  name?: string
  owner?: { name?: string; email?: string }
}

/**
 * Provider Clover api_key.
 *
 * NO implementa `IProvider` (esa interfaz es OAuth-only). Es un provider
 * de tipo api_key — el merchant genera un token desde su dashboard
 * (Account & Setup → API Tokens) y lo guarda como `credentials.api_token`.
 *
 * Shape de credentials esperada:
 *   { api_token: string, merchant_id: string }
 *
 * NOTA: el `merchant_id` en credentials DEBE coincidir con el
 * `external_account_id` de la conexión. El service lo valida al crear.
 */
@Injectable()
export class CloverApiKeyProvider {
  readonly name = 'clover' as const
  readonly authType = 'api_key' as const

  constructor(@Optional() @Inject(CLOVER_FETCH) private readonly fetchFn: typeof fetch = fetch) {}

  /**
   * Valida que credentials tenga la shape correcta. Lanza
   * `CredentialsShapeError` (HTTP 400) si falta algún campo.
   * Llamado al crear/actualizar conexión.
   */
  validateCredentials(credentials: Record<string, unknown>): {
    apiToken: string
    merchantId: string
  } {
    if (typeof credentials.api_token !== 'string' || credentials.api_token.length === 0) {
      throw new CredentialsShapeError('clover', 'api_token')
    }
    if (typeof credentials.merchant_id !== 'string' || credentials.merchant_id.length === 0) {
      throw new CredentialsShapeError('clover', 'merchant_id')
    }
    return { apiToken: credentials.api_token, merchantId: credentials.merchant_id }
  }

  /**
   * Llama GET /v3/merchants/{merchantId}?expand=owner. Sirve tanto para
   * `test()` como para resolver info del merchant al guardar la conexión.
   */
  async fetchMerchant(
    apiToken: string,
    merchantId: string,
  ): Promise<{ id: string; name: string | null; ownerEmail: string | null }> {
    const res = await this.fetchFn(`${CLOVER_API_BASE}/v3/merchants/${merchantId}?expand=owner`, {
      headers: { Authorization: `Bearer ${apiToken}`, Accept: 'application/json' },
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new ConnectionAuthError(`Clover GET /v3/merchants falló (${res.status}): ${body}`)
    }
    const data = (await res.json()) as CloverMerchantResponse
    return {
      id: data.id,
      name: data.name ?? null,
      ownerEmail: data.owner?.email ?? null,
    }
  }

  async test(connection: DecryptedApiKeyConnection): Promise<TestResult> {
    const { apiToken, merchantId } = this.validateCredentials(connection.credentials)
    const merchant = await this.fetchMerchant(apiToken, merchantId)
    return {
      ok: true,
      message: `Merchant Clover ${merchant.name ?? merchant.id} accesible`,
    }
  }
}
