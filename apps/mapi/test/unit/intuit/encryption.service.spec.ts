import { randomBytes } from 'node:crypto'
import { EncryptionService } from '../../../src/core/encryption/encryption.service'

/**
 * Tests Tipo A para EncryptionService. AES-256-GCM nativo, sin DB ni red.
 *
 * Cobertura:
 * - CR-intuit-001: encrypt + decrypt round-trip preserva plaintext.
 * - CR-intuit-002: IV random produce ciphertext distinto cada llamada.
 * - CR-intuit-003: decrypt con key incorrecta lanza.
 * - CR-intuit-004: decrypt con tag/ciphertext modificado lanza (tamper).
 */

const TEST_KEY = randomBytes(32).toString('base64')

describe('EncryptionService', () => {
  let svc: EncryptionService

  beforeEach(() => {
    svc = new EncryptionService(TEST_KEY)
  })

  describe('CR-intuit-001 — round-trip', () => {
    it('encrypt + decrypt retorna el plaintext original', () => {
      const plaintext = 'super-secret-token-abc-123'
      const cipher = svc.encrypt(plaintext)
      expect(cipher).not.toBe(plaintext)
      expect(svc.decrypt(cipher)).toBe(plaintext)
    })

    it('cifra strings largos (refresh token típico)', () => {
      const longToken =
        'AB11700123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()'
      expect(svc.decrypt(svc.encrypt(longToken))).toBe(longToken)
    })

    it('cifra unicode (emojis, acentos)', () => {
      const text = 'Ciudad de México 🇲🇽 + token'
      expect(svc.decrypt(svc.encrypt(text))).toBe(text)
    })
  })

  describe('CR-intuit-002 — IV random', () => {
    it('produce ciphertexts distintos para el mismo plaintext', () => {
      const plaintext = 'same-input'
      const c1 = svc.encrypt(plaintext)
      const c2 = svc.encrypt(plaintext)
      expect(c1).not.toBe(c2)
      expect(svc.decrypt(c1)).toBe(plaintext)
      expect(svc.decrypt(c2)).toBe(plaintext)
    })

    it('formato iv:authTag:ciphertext (3 segmentos base64)', () => {
      const cipher = svc.encrypt('hello')
      const parts = cipher.split(':')
      expect(parts).toHaveLength(3)
      expect(parts[0]?.length).toBeGreaterThan(0)
      expect(parts[1]?.length).toBeGreaterThan(0)
      expect(parts[2]?.length).toBeGreaterThan(0)
    })
  })

  describe('CR-intuit-003 — key incorrecta', () => {
    it('una key distinta no puede descifrar el ciphertext de la original', () => {
      const otherKey = randomBytes(32).toString('base64')
      const otherSvc = new EncryptionService(otherKey)
      const cipher = svc.encrypt('secret')
      expect(() => otherSvc.decrypt(cipher)).toThrow()
    })

    it('lanza si se construye con key de tamaño incorrecto', () => {
      const tooShort = Buffer.from('short').toString('base64')
      expect(() => new EncryptionService(tooShort)).toThrow()
    })
  })

  describe('CR-intuit-004 — tamper detection (GCM auth tag)', () => {
    it('lanza cuando el ciphertext fue modificado', () => {
      const cipher = svc.encrypt('original')
      const [iv, authTag, ct] = cipher.split(':')
      const tamperedCt = Buffer.from(ct ?? '', 'base64')
      tamperedCt[0] = (tamperedCt[0] ?? 0) ^ 0xff
      const tampered = `${iv}:${authTag}:${tamperedCt.toString('base64')}`
      expect(() => svc.decrypt(tampered)).toThrow()
    })

    it('lanza cuando el authTag fue modificado', () => {
      const cipher = svc.encrypt('original')
      const [iv, authTag, ct] = cipher.split(':')
      const tamperedTag = Buffer.from(authTag ?? '', 'base64')
      tamperedTag[0] = (tamperedTag[0] ?? 0) ^ 0xff
      const tampered = `${iv}:${tamperedTag.toString('base64')}:${ct}`
      expect(() => svc.decrypt(tampered)).toThrow()
    })

    it('lanza con cipher mal formado (segmentos != 3)', () => {
      expect(() => svc.decrypt('not-a-cipher')).toThrow()
      expect(() => svc.decrypt('only:two')).toThrow()
      expect(() => svc.decrypt('a:b:c:d')).toThrow()
    })
  })
})
