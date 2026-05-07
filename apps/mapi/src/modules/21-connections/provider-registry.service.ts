import { Injectable } from '@nestjs/common'
import { ProviderNotSupportedError } from './connection.errors'
import { IntuitProvider } from './providers/intuit/intuit.provider'
import { MicrosoftProvider } from './providers/microsoft/microsoft.provider'
import type { IProvider } from './providers/provider.interface'

/**
 * Registry de providers disponibles.
 * - v0.7.0: Microsoft.
 * - v0.8.0: Intuit (migrado desde 20-intuit-oauth).
 * - Futuro: Google, Dropbox.
 *
 * Cuando entre Google:
 *   constructor(microsoft, intuit, google) {}
 *   if (name === 'google') return this.google
 */
@Injectable()
export class ProviderRegistry {
  constructor(
    private readonly microsoft: MicrosoftProvider,
    private readonly intuit: IntuitProvider,
  ) {}

  get(name: string): IProvider {
    if (name === 'microsoft') return this.microsoft
    if (name === 'intuit') return this.intuit
    throw new ProviderNotSupportedError(name)
  }
}
