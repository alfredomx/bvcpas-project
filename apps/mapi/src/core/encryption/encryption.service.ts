import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { Inject, Injectable } from '@nestjs/common'
import { AppConfigService } from '../config/config.service'

export const ENCRYPTION_KEY_TOKEN = Symbol('ENCRYPTION_KEY')

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const KEY_LENGTH = 32

/**
 * Cifra/descifra strings con AES-256-GCM. Formato: `iv:authTag:ciphertext`
 * en base64 separado por `:`. El authTag detecta tamper (heredado mapi v0.x).
 */
@Injectable()
export class EncryptionService {
  private readonly key: Buffer

  constructor(@Inject(ENCRYPTION_KEY_TOKEN) keyBase64: string) {
    const buf = Buffer.from(keyBase64, 'base64')
    if (buf.length !== KEY_LENGTH) {
      throw new Error(
        `EncryptionService: key must be ${KEY_LENGTH} bytes (base64), got ${buf.length}`,
      )
    }
    this.key = buf
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_LENGTH)
    const cipher = createCipheriv(ALGORITHM, this.key, iv)
    const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
    const authTag = cipher.getAuthTag()
    return [iv.toString('base64'), authTag.toString('base64'), ct.toString('base64')].join(':')
  }

  decrypt(cipher: string): string {
    const parts = cipher.split(':')
    if (parts.length !== 3) {
      throw new Error('EncryptionService.decrypt: malformed cipher (expected iv:authTag:ct)')
    }
    const [ivB64, tagB64, ctB64] = parts
    const iv = Buffer.from(ivB64 ?? '', 'base64')
    const authTag = Buffer.from(tagB64 ?? '', 'base64')
    const ct = Buffer.from(ctB64 ?? '', 'base64')

    const decipher = createDecipheriv(ALGORITHM, this.key, iv)
    decipher.setAuthTag(authTag)
    const plain = Buffer.concat([decipher.update(ct), decipher.final()])
    return plain.toString('utf8')
  }
}

export function encryptionServiceFactory(cfg: AppConfigService): EncryptionService {
  return new EncryptionService(cfg.encryptionKey)
}
