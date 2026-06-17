import { Injectable } from '@nestjs/common'
import { IntuitConfigService } from './intuit.config'
import { IntuitTokensService } from './intuit-tokens.service'
import { IntuitAuthError, IntuitBadRequestError } from './intuit.errors'

/** Mes fiscal de QBO ("January"…) → número 1-12. */
const FISCAL_MONTHS: Record<string, number> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
}

interface QboCompanyInfoResponse {
  CompanyInfo?: {
    CompanyName?: string
    LegalName?: string
    FiscalYearStartMonth?: string
    Email?: { Address?: string }
  }
}

/** CompanyInfo de QBO mapeada a la forma del client (para ofrecer overwrite). */
export interface MappedCompanyInfo {
  legalName?: string
  fiscalYearStart?: number
  primaryContactEmail?: string
}

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

  /** Trae `CompanyInfo` de QBO y la mapea a campos del client (no sobreescribe). */
  async getCompanyInfo(clientId: string): Promise<MappedCompanyInfo> {
    const { realmId } = await this.tokens.getValidAccessToken(clientId)
    const data = (await this.call(
      clientId,
      'GET',
      `/company/${realmId}/companyinfo/${realmId}`,
    )) as QboCompanyInfoResponse
    const ci = data.CompanyInfo
    const month = ci?.FiscalYearStartMonth?.toLowerCase()
    return {
      legalName: ci?.LegalName ?? ci?.CompanyName,
      fiscalYearStart: month ? FISCAL_MONTHS[month] : undefined,
      primaryContactEmail: ci?.Email?.Address,
    }
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
