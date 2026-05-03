import { PasswordService } from '../../../src/core/auth/password.service'
import type { AppConfigService } from '../../../src/core/config/config.service'
import { WeakPasswordError } from '../../../src/modules/10-core-auth/errors'

/**
 * Tests Tipo A para PasswordService. No tocan DB ni red.
 *
 * Cobertura:
 * - CR-auth-033: validateStrength rechaza passwords <8 chars.
 * - CR-auth-034: hash() retorna string distinto al plain. compare() retorna boolean.
 */

function buildService(bcryptCost = 4): PasswordService {
  // Cost 4 en tests para velocidad. En prod default 12.
  const cfg = {
    bcryptCost,
  } as AppConfigService
  return new PasswordService(cfg)
}

describe('PasswordService', () => {
  describe('hash y compare (CR-auth-034)', () => {
    it('hash() retorna string distinto al plain', async () => {
      const service = buildService()
      const plain = 'mi-password-segura'
      const hashed = await service.hash(plain)

      expect(typeof hashed).toBe('string')
      expect(hashed).not.toBe(plain)
      expect(hashed.length).toBeGreaterThan(plain.length)
    })

    it('compare() con hash correcto retorna true', async () => {
      const service = buildService()
      const plain = 'mi-password-segura'
      const hashed = await service.hash(plain)

      const result = await service.compare(plain, hashed)
      expect(result).toBe(true)
    })

    it('compare() con hash incorrecto retorna false', async () => {
      const service = buildService()
      const hashed = await service.hash('password-original')

      const result = await service.compare('password-incorrecta', hashed)
      expect(result).toBe(false)
    })

    it('compare() siempre retorna boolean (nunca el plain)', async () => {
      const service = buildService()
      const hashed = await service.hash('xyz')

      const ok = await service.compare('xyz', hashed)
      const ko = await service.compare('zyx', hashed)

      expect(typeof ok).toBe('boolean')
      expect(typeof ko).toBe('boolean')
    })
  })

  describe('generateRandomPassword', () => {
    it('genera password de longitud especificada', () => {
      const service = buildService()
      expect(service.generateRandomPassword(24)).toHaveLength(24)
      expect(service.generateRandomPassword(8)).toHaveLength(8)
    })

    it('default es 24 chars', () => {
      const service = buildService()
      expect(service.generateRandomPassword()).toHaveLength(24)
    })

    it('genera passwords distintas en cada llamada', () => {
      const service = buildService()
      const a = service.generateRandomPassword()
      const b = service.generateRandomPassword()
      expect(a).not.toBe(b)
    })

    it('no incluye caracteres ambiguos (0, O, 1, l, I)', () => {
      const service = buildService()
      // Genera 100 passwords y verifica que ninguna tiene chars ambiguos.
      for (let i = 0; i < 100; i++) {
        const pwd = service.generateRandomPassword(32)
        expect(pwd).not.toMatch(/[0O1lI]/)
      }
    })
  })

  describe('validateStrength (CR-auth-033)', () => {
    it('lanza WeakPasswordError con password de 7 chars', () => {
      const service = buildService()
      expect(() => service.validateStrength('1234567')).toThrow(WeakPasswordError)
    })

    it('lanza WeakPasswordError con password vacía', () => {
      const service = buildService()
      expect(() => service.validateStrength('')).toThrow(WeakPasswordError)
    })

    it('NO lanza con password de 8 chars (límite inferior)', () => {
      const service = buildService()
      expect(() => service.validateStrength('12345678')).not.toThrow()
    })

    it('NO lanza con password larga', () => {
      const service = buildService()
      expect(() => service.validateStrength('una-password-suficientemente-larga')).not.toThrow()
    })
  })
})
