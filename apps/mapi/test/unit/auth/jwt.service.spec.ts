import { JwtService } from '../../../src/core/auth/jwt.service'
import type { AppConfigService } from '../../../src/core/config/config.service'

/**
 * Tests Tipo A para JwtService.
 *
 * Cobertura:
 * - CR-auth-010 (parcial): verify() con firma inválida lanza error.
 * - sign() retorna formato JWT válido (3 partes).
 * - sign() incluye claims pasados.
 * - verify() devuelve los claims firmados.
 */

const SECRET = 'test_jwt_secret_at_least_32_chars_long_for_tests_only'

function buildService(secret = SECRET, expiresIn = '7d'): JwtService {
  const cfg = {
    jwtSecret: secret,
    jwtExpiresIn: expiresIn,
  } as AppConfigService
  return new JwtService(cfg)
}

describe('JwtService', () => {
  describe('sign', () => {
    it('retorna string formato JWT (3 partes separadas por punto)', () => {
      const service = buildService()
      const token = service.sign({
        sub: 'user-123',
        email: 'test@example.com',
        role: 'admin',
        jti: 'jti-abc',
      })

      expect(typeof token).toBe('string')
      expect(token.split('.')).toHaveLength(3)
    })

    it('claims firmados se recuperan al verify()', () => {
      const service = buildService()
      const token = service.sign({
        sub: 'user-123',
        email: 'test@example.com',
        role: 'viewer',
        jti: 'jti-xyz',
      })

      const decoded = service.verify(token)
      expect(decoded.sub).toBe('user-123')
      expect(decoded.email).toBe('test@example.com')
      expect(decoded.role).toBe('viewer')
      expect(decoded.jti).toBe('jti-xyz')
      expect(typeof decoded.iat).toBe('number')
      expect(typeof decoded.exp).toBe('number')
      expect(decoded.exp).toBeGreaterThan(decoded.iat!)
    })
  })

  describe('verify (CR-auth-010 parcial)', () => {
    it('lanza error con firma inválida', () => {
      const service = buildService()
      const token = service.sign({
        sub: 'user-123',
        email: 'a@b.com',
        role: 'admin',
        jti: 'j1',
      })

      const parts = token.split('.')
      const tampered = `${parts[0]}.${parts[1]}.${parts[2].slice(0, -1)}X`

      expect(() => service.verify(tampered)).toThrow()
    })

    it('lanza error con secret distinto', () => {
      const serviceA = buildService(SECRET)
      const token = serviceA.sign({
        sub: 'u',
        email: 'a@b.com',
        role: 'admin',
        jti: 'j1',
      })

      const serviceB = buildService('otro_secret_distinto_de_al_menos_32_chars_xxxx')
      expect(() => serviceB.verify(token)).toThrow()
    })

    it('lanza error con token expirado', () => {
      const service = buildService(SECRET, '1ms')
      const token = service.sign({
        sub: 'u',
        email: 'a@b.com',
        role: 'admin',
        jti: 'j1',
      })

      return new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(() => service.verify(token)).toThrow()
          resolve()
        }, 50)
      })
    })

    it('lanza error con string que no es JWT', () => {
      const service = buildService()
      expect(() => service.verify('not-a-jwt')).toThrow()
      expect(() => service.verify('')).toThrow()
    })
  })
})
