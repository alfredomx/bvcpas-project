import { Inject, Injectable, Optional } from '@nestjs/common'
import { ProviderApiError } from '../../connection.errors'

const GRAPH_SEND_MAIL_URL = 'https://graph.microsoft.com/v1.0/me/sendMail'

export const MSFT_FETCH = Symbol('MSFT_FETCH')

export interface SendMailInput {
  to: string
  subject: string
  body: string
}

@Injectable()
export class GraphMailService {
  constructor(@Optional() @Inject(MSFT_FETCH) private readonly fetchFn: typeof fetch = fetch) {}

  async sendMail(accessToken: string, input: SendMailInput): Promise<void> {
    const payload = {
      message: {
        subject: input.subject,
        body: { contentType: 'Text', content: input.body },
        toRecipients: [{ emailAddress: { address: input.to } }],
      },
      saveToSentItems: true,
    }

    const res = await this.fetchFn(GRAPH_SEND_MAIL_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new ProviderApiError(`Graph sendMail falló (${res.status})`, res.status, text)
    }
  }
}
