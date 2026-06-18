import { Injectable } from '@nestjs/common'
import { EncryptionService } from '@/core/encryption/encryption.service'
import type {
  BankCredentialsPort,
  DecryptedBankCredential,
} from '@/contracts/bank-credentials.port'
import { BankCredentialsRepository } from './bank-credentials.repository'
import { BankCredentialNotFoundError } from './bank-credentials.errors'

/**
 * Implementación del `BankCredentialsPort` del core. Descifra los secretos del
 * login con el `EncryptionService` y adjunta el nombre del portal (join).
 * Es la cara pública de `bank-credentials` hacia otros plugins (D-bank-008).
 */
@Injectable()
export class BankCredentialsPortAdapter implements BankCredentialsPort {
  constructor(
    private readonly repo: BankCredentialsRepository,
    private readonly encryption: EncryptionService,
  ) {}

  async getDecrypted(credentialId: string): Promise<DecryptedBankCredential> {
    const row = await this.repo.findByIdWithPortal(credentialId)
    if (!row) throw new BankCredentialNotFoundError(credentialId)
    const c = row.credential
    return {
      id: c.id,
      clientId: c.clientId,
      bankPortalId: c.bankPortalId,
      portalName: row.portal.name,
      username: c.usernameEncrypted ? this.encryption.decrypt(c.usernameEncrypted) : null,
      password: c.passwordEncrypted ? this.encryption.decrypt(c.passwordEncrypted) : null,
      securityQa: c.securityQaEncrypted ? this.encryption.decrypt(c.securityQaEncrypted) : null,
      status: c.status,
    }
  }
}
