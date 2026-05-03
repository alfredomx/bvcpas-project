import { Injectable } from '@nestjs/common'
import { hash, compare } from 'bcrypt'
import { randomBytes } from 'node:crypto'
import { AppConfigService } from '../config/config.service'
import { WeakPasswordError } from '../../modules/10-core-auth/errors'

/**
 * Servicio de hashing y validación de contraseñas.
 *
 * Wrapper sobre `bcrypt`. Hash cost configurable vía env (BCRYPT_COST,
 * default 12). Genera passwords aleatorias para seed admin y reset.
 */

const PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'

const MIN_PASSWORD_LENGTH = 8

@Injectable()
export class PasswordService {
  constructor(private readonly cfg: AppConfigService) {}

  /**
   * Hashea una contraseña en plano. Usa bcrypt con el cost configurado.
   */
  async hash(plain: string): Promise<string> {
    return hash(plain, this.cfg.bcryptCost)
  }

  /**
   * Compara una contraseña en plano contra un hash bcrypt. Retorna boolean.
   * NUNCA retorna el plain. NUNCA retorna información del hash.
   */
  async compare(plain: string, hashed: string): Promise<boolean> {
    return compare(plain, hashed)
  }

  /**
   * Genera una contraseña aleatoria sin caracteres ambiguos (0/O, 1/l/I).
   * Usada por seed admin y reset de password por admin.
   */
  generateRandomPassword(length = 24): string {
    const buffer = randomBytes(length)
    let result = ''
    for (let i = 0; i < length; i++) {
      result += PASSWORD_ALPHABET[buffer[i] % PASSWORD_ALPHABET.length]
    }
    return result
  }

  /**
   * Valida que la password cumple con la política mínima.
   * Lanza WeakPasswordError si no la cumple.
   *
   * Política minimal: longitud mínima 8 caracteres. Sin reglas de
   * mayúsculas/símbolos/etc. (esas reglas llevan a passwords predecibles
   * tipo `Abc12345!`).
   */
  validateStrength(plain: string): void {
    if (plain.length < MIN_PASSWORD_LENGTH) {
      throw new WeakPasswordError({ minLength: MIN_PASSWORD_LENGTH })
    }
  }
}
