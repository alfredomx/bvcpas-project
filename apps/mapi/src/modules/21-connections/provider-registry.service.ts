import { Injectable } from '@nestjs/common'
import { ProviderNotSupportedError } from './connection.errors'
import { MicrosoftProvider } from './providers/microsoft/microsoft.provider'
import type { IProvider } from './providers/provider.interface'

/**
 * Registry de providers disponibles. v0.7.0 solo registra Microsoft;
 * Google y Dropbox se pre-declaran en el schema (`PROVIDERS`) pero
 * lanzan `PROVIDER_NOT_SUPPORTED` aquí hasta que se implementen sus
 * `<X>Provider`.
 *
 * Cuando entre v0.7.1 (Google):
 *   constructor(microsoft, google) {}
 *   if (name === 'google') return this.google
 */
@Injectable()
export class ProviderRegistry {
  constructor(private readonly microsoft: MicrosoftProvider) {}

  get(name: string): IProvider {
    if (name === 'microsoft') return this.microsoft
    throw new ProviderNotSupportedError(name)
  }
}
