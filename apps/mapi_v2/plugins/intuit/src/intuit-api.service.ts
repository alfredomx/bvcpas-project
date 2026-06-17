import { Injectable } from '@nestjs/common'
import { IntuitConfigService } from './intuit.config'
import { IntuitTokensService } from './intuit-tokens.service'
import { IntuitAuthError, IntuitBadRequestError } from './intuit.errors'

/**
 * Proxy genérico a la API V3 de QuickBooks. Resuelve el access token del
 * cliente (refresh transparente), arma la URL con la base del entorno + el
 * minorversion, y si QBO responde 401 fuerza un refresh y reintenta una vez.
 */
@Injectable()
export class IntuitApiService {
  constructor(
    private readonly tokens: IntuitTokensService,
    private readonly config: IntuitConfigService,
  ) {}

  async call(clientId: string, method: string, path: string, body?: unknown): Promise<unknown> {
    const { accessToken } = await this.tokens.getValidAccessToken(clientId)
    let res = await this.fetchQbo(accessToken, method, path, body)

    if (res.status === 401) {
      const refreshed = await this.tokens.refresh(clientId)
      res = await this.fetchQbo(refreshed.accessToken, method, path, body)
    }

    const text = await res.text()
    let data: unknown = null
    if (text) {
      try {
        data = JSON.parse(text)
      } catch {
        data = text
      }
    }

    if (!res.ok) {
      if (res.status >= 400 && res.status < 500) {
        throw new IntuitBadRequestError(`QBO respondió ${res.status}`, {
          status: res.status,
          body: data,
        })
      }
      throw new IntuitAuthError(`QBO respondió ${res.status}`, { status: res.status, body: data })
    }

    return data
  }

  private fetchQbo(
    accessToken: string,
    method: string,
    path: string,
    body?: unknown,
  ): Promise<Response> {
    const sep = path.includes('?') ? '&' : '?'
    const url = `${this.config.apiBaseUrl}${path}${sep}minorversion=${this.config.minorVersion}`
    return fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  }
}
