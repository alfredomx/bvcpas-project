import { ProviderRegistry } from '../../../src/modules/21-connections/provider-registry.service'
import type { MicrosoftProvider } from '../../../src/modules/21-connections/providers/microsoft/microsoft.provider'
import { ProviderNotSupportedError } from '../../../src/modules/21-connections/connection.errors'

/**
 * Tests Tipo A para ProviderRegistry.
 *
 * Cobertura:
 * - CR-conn-009: get('microsoft') devuelve MicrosoftProvider.
 * - CR-conn-010: get('google') lanza PROVIDER_NOT_SUPPORTED (no implementado).
 */

describe('ProviderRegistry', () => {
  describe('CR-conn-009 — microsoft registrado', () => {
    it('get("microsoft") devuelve la instancia de MicrosoftProvider', () => {
      const microsoft = { name: 'microsoft' } as unknown as MicrosoftProvider
      const registry = new ProviderRegistry(microsoft)

      const provider = registry.get('microsoft')

      expect(provider).toBe(microsoft)
    })
  })

  describe('CR-conn-010 — google no implementado', () => {
    it('get("google") lanza ProviderNotSupportedError', () => {
      const microsoft = { name: 'microsoft' } as unknown as MicrosoftProvider
      const registry = new ProviderRegistry(microsoft)

      expect(() => registry.get('google')).toThrow(ProviderNotSupportedError)
    })

    it('get("dropbox") también lanza', () => {
      const microsoft = { name: 'microsoft' } as unknown as MicrosoftProvider
      const registry = new ProviderRegistry(microsoft)

      expect(() => registry.get('dropbox')).toThrow(ProviderNotSupportedError)
    })
  })
})
