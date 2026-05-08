import { ProviderRegistry } from '../../../src/modules/21-connections/provider-registry.service'
import type { DropboxProvider } from '../../../src/modules/21-connections/providers/dropbox/dropbox.provider'
import type { GoogleProvider } from '../../../src/modules/21-connections/providers/google/google.provider'
import type { IntuitProvider } from '../../../src/modules/21-connections/providers/intuit/intuit.provider'
import type { MicrosoftProvider } from '../../../src/modules/21-connections/providers/microsoft/microsoft.provider'
import type { SquareProvider } from '../../../src/modules/21-connections/providers/square/square.provider'
import { ProviderNotSupportedError } from '../../../src/modules/21-connections/connection.errors'

/**
 * Tests Tipo A para ProviderRegistry.
 *
 * Cobertura:
 * - CR-conn-009: get('microsoft') devuelve MicrosoftProvider.
 * - CR-conn-040: get('intuit') devuelve IntuitProvider (v0.8.0).
 * - CR-conn-052: get('dropbox') devuelve DropboxProvider (v0.9.0).
 * - CR-conn-053: get('google')  devuelve GoogleProvider  (v0.9.0).
 * - CR-conn-010: get(<unknown>) lanza PROVIDER_NOT_SUPPORTED.
 */

const microsoftFake = { name: 'microsoft' } as unknown as MicrosoftProvider
const intuitFake = { name: 'intuit' } as unknown as IntuitProvider
const dropboxFake = { name: 'dropbox' } as unknown as DropboxProvider
const googleFake = { name: 'google' } as unknown as GoogleProvider
const squareFake = { name: 'square' } as unknown as SquareProvider

function buildRegistry(): ProviderRegistry {
  return new ProviderRegistry(microsoftFake, intuitFake, dropboxFake, googleFake, squareFake)
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

  describe('CR-conn-052 — dropbox registrado (v0.9.0)', () => {
    it('get("dropbox") devuelve la instancia de DropboxProvider', () => {
      expect(buildRegistry().get('dropbox')).toBe(dropboxFake)
    })
  })

  describe('CR-conn-053 — google registrado (v0.9.0)', () => {
    it('get("google") devuelve la instancia de GoogleProvider', () => {
      expect(buildRegistry().get('google')).toBe(googleFake)
    })
  })

  describe('CR-conn-086 — square registrado (v0.12.0)', () => {
    it('get("square") devuelve la instancia de SquareProvider', () => {
      expect(buildRegistry().get('square')).toBe(squareFake)
    })
  })

  describe('CR-conn-010 — providers no implementados', () => {
    it('get("foobar") lanza ProviderNotSupportedError', () => {
      expect(() => buildRegistry().get('foobar')).toThrow(ProviderNotSupportedError)
    })
  })
})
