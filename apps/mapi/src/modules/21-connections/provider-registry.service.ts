import { Injectable } from '@nestjs/common'
import { ProviderNotSupportedError } from './connection.errors'
import { DropboxProvider } from './providers/dropbox/dropbox.provider'
import { GoogleProvider } from './providers/google/google.provider'
import { IntuitProvider } from './providers/intuit/intuit.provider'
import { MicrosoftProvider } from './providers/microsoft/microsoft.provider'
import { SquareProvider } from './providers/square/square.provider'
import type { IProvider } from './providers/provider.interface'

/**
 * Registry de providers OAuth disponibles.
 * - v0.7.0: Microsoft.
 * - v0.8.0: Intuit (migrado desde 20-intuit-oauth).
 * - v0.9.0: Dropbox + Google.
 * - v0.12.0: Square.
 *
 * NOTA: providers api_key (CloverApiKeyProvider) NO viven aquí — se
 * inyectan directos donde se usen.
 */
@Injectable()
export class ProviderRegistry {
  constructor(
    private readonly microsoft: MicrosoftProvider,
    private readonly intuit: IntuitProvider,
    private readonly dropbox: DropboxProvider,
    private readonly google: GoogleProvider,
    private readonly square: SquareProvider,
  ) {}

  get(name: string): IProvider {
    if (name === 'microsoft') return this.microsoft
    if (name === 'intuit') return this.intuit
    if (name === 'dropbox') return this.dropbox
    if (name === 'google') return this.google
    if (name === 'square') return this.square
    throw new ProviderNotSupportedError(name)
  }
}
