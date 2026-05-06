import { Injectable } from '@nestjs/common'
import { EncryptionService } from '../../../core/encryption/encryption.service'
import type { DecryptedUserMicrosoftToken } from '../../../db/schema/user-microsoft-tokens'
import { MicrosoftTokensNotFoundError } from '../microsoft-oauth.errors'
import { MicrosoftTokensRepository } from './microsoft-tokens.repository'

export interface UpsertPlainMicrosoftToken {
  userId: string
  microsoftUserId: string
  email: string
  scopes: string
  accessToken: string
  refreshToken: string
  accessTokenExpiresAt: Date
}

/**
 * Tokens Microsoft cifrados al guardar y descifrados al leer. Plaintext
 * solo vive en memoria. Patrón espejo de IntuitTokensService pero por
 * usuario.
 */
@Injectable()
export class MicrosoftTokensService {
  constructor(
    private readonly repo: MicrosoftTokensRepository,
    private readonly encryption: EncryptionService,
  ) {}

  async upsert(data: UpsertPlainMicrosoftToken): Promise<void> {
    await this.repo.upsert({
      userId: data.userId,
      microsoftUserId: data.microsoftUserId,
      email: data.email,
      scopes: data.scopes,
      accessTokenEncrypted: this.encryption.encrypt(data.accessToken),
      refreshTokenEncrypted: this.encryption.encrypt(data.refreshToken),
      accessTokenExpiresAt: data.accessTokenExpiresAt,
    })
  }

  async getDecryptedByUserId(userId: string): Promise<DecryptedUserMicrosoftToken> {
    const row = await this.repo.findByUserId(userId)
    if (!row) throw new MicrosoftTokensNotFoundError(userId)
    return {
      userId: row.userId,
      microsoftUserId: row.microsoftUserId,
      email: row.email,
      scopes: row.scopes,
      accessToken: this.encryption.decrypt(row.accessTokenEncrypted),
      refreshToken: this.encryption.decrypt(row.refreshTokenEncrypted),
      accessTokenExpiresAt: row.accessTokenExpiresAt,
    }
  }

  async findRowByUserId(userId: string): ReturnType<MicrosoftTokensRepository['findByUserId']> {
    return this.repo.findByUserId(userId)
  }

  async deleteByUserId(userId: string): Promise<void> {
    await this.repo.deleteByUserId(userId)
  }
}
