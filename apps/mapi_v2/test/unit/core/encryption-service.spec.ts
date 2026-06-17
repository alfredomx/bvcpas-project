import { randomBytes } from 'node:crypto'
import { EncryptionService } from '@/core/encryption/encryption.service'

const KEY = randomBytes(32).toString('base64')

describe('EncryptionService', () => {
  const svc = new EncryptionService(KEY)

  it('round-trip: decrypt(encrypt(x)) === x', () => {
    const plain = 'token-secreto-123'
    expect(svc.decrypt(svc.encrypt(plain))).toBe(plain)
  })

  it('dos encrypt del mismo texto dan ciphertext distinto (iv aleatorio)', () => {
    const a = svc.encrypt('mismo')
    const b = svc.encrypt('mismo')
    expect(a).not.toBe(b)
    expect(svc.decrypt(a)).toBe('mismo')
    expect(svc.decrypt(b)).toBe('mismo')
  })

  it('formato iv:authTag:ciphertext (3 partes base64)', () => {
    const parts = svc.encrypt('x').split(':')
    expect(parts).toHaveLength(3)
  })

  it('decrypt de un cipher manipulado falla (authTag detecta tamper)', () => {
    const [iv, tag, ct] = svc.encrypt('intacto').split(':')
    const tampered = [iv, tag, Buffer.from('otracosa').toString('base64')].join(':')
    expect(() => svc.decrypt(tampered)).toThrow()
  })

  it('decrypt de cipher mal formado falla', () => {
    expect(() => svc.decrypt('solo-una-parte')).toThrow()
  })

  it('construir con key de tamaño inválido revienta', () => {
    expect(() => new EncryptionService(randomBytes(16).toString('base64'))).toThrow()
  })
})
