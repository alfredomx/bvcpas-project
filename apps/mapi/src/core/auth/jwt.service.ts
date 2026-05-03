import { Injectable } from '@nestjs/common'
import jwt from 'jsonwebtoken'
import type { SignOptions } from 'jsonwebtoken'
import { AppConfigService } from '../config/config.service'
import type { UserRole } from '../../db/schema/users'

/**
 * Claims que viajan dentro del JWT.
 * - sub: user id (UUID).
 * - email, role: para guards sin pegarle a DB en happy path.
 * - jti: id de la sesión (UUID), buscado en `user_sessions` para verificar
 *   que la sesión sigue activa y no revocada.
 * - iat / exp: standard JWT (numéricos en segundos UNIX).
 */
export interface JwtPayload {
  sub: string
  email: string
  role: UserRole
  jti: string
  iat?: number
  exp?: number
}

/**
 * Wrapper sobre `jsonwebtoken` para firmar y verificar JWTs con
 * `JWT_SECRET` y `JWT_EXPIRES_IN` del config.
 *
 * Lanza Error de jsonwebtoken si firma inválida o expirado. Los guards
 * mapean estos errores a UnauthorizedException o errores de dominio
 * más específicos donde sea apropiado.
 */
@Injectable()
export class JwtService {
  constructor(private readonly cfg: AppConfigService) {}

  sign(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
    const options: SignOptions = {
      expiresIn: this.cfg.jwtExpiresIn as SignOptions['expiresIn'],
    }
    return jwt.sign(payload, this.cfg.jwtSecret, options)
  }

  verify(token: string): JwtPayload {
    return jwt.verify(token, this.cfg.jwtSecret) as JwtPayload
  }
}
