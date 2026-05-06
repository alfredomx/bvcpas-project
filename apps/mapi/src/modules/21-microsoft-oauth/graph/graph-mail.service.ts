import { Inject, Injectable, Optional } from '@nestjs/common'
import { MicrosoftGraphError } from '../microsoft-oauth.errors'
import { MSFT_FETCH, MicrosoftTokenRefreshService } from '../tokens/microsoft-token-refresh.service'

const GRAPH_SEND_MAIL_URL = 'https://graph.microsoft.com/v1.0/me/sendMail'

export interface SendMailInput {
  to: string
  subject: string
  body: string
}

@Injectable()
export class GraphMailService {
  constructor(
    private readonly refresh: MicrosoftTokenRefreshService,
    @Optional() @Inject(MSFT_FETCH) private readonly fetchFn: typeof fetch = fetch,
  ) {}

  async sendMail(userId: string, input: SendMailInput): Promise<void> {
    const accessToken = await this.refresh.getValidAccessToken(userId)

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
      throw new MicrosoftGraphError(`Graph sendMail falló (${res.status})`, res.status, text)
    }
  }
}
