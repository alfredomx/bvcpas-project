import { ProviderRegistry } from '../../../src/modules/21-connections/provider-registry.service'
import type { IntuitProvider } from '../../../src/modules/21-connections/providers/intuit/intuit.provider'
import type { MicrosoftProvider } from '../../../src/modules/21-connections/providers/microsoft/microsoft.provider'
import { ProviderNotSupportedError } from '../../../src/modules/21-connections/connection.errors'

/**
 * Tests Tipo A para ProviderRegistry.
 *
 * Cobertura:
 * - CR-conn-009: get('microsoft') devuelve MicrosoftProvider.
 * - CR-conn-010: get('google') lanza PROVIDER_NOT_SUPPORTED.
 * - CR-conn-040: get('intuit') devuelve IntuitProvider (v0.8.0).
 */

const microsoftFake = { name: 'microsoft' } as unknown as MicrosoftProvider
const intuitFake = { name: 'intuit' } as unknown as IntuitProvider

function buildRegistry(): ProviderRegistry {
  return new ProviderRegistry(microsoftFake, intuitFake)
}

describe('ProviderRegistry', () => {
  describe('CR-conn-009 — microsoft registrado', () => {
    it('get("microsoft") devuelve la instancia de MicrosoftProvider', () => {
      expect(buildRegistry().get('microsoft')).toBe(microsoftFake)
    })
  })

  describe('CR-conn-040 — intuit registrado (v0.8.0)', () => {
    it('get("intuit") devuelve la instancia de IntuitProvider', () => {
      expect(buildRegistry().get('intuit')).toBe(intuitFake)
    })
  })

  describe('CR-conn-010 — providers no implementados', () => {
    it('get("google") lanza ProviderNotSupportedError', () => {
      expect(() => buildRegistry().get('google')).toThrow(ProviderNotSupportedError)
    })

    it('get("dropbox") también lanza', () => {
      expect(() => buildRegistry().get('dropbox')).toThrow(ProviderNotSupportedError)
    })
  })
})
