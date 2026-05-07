import {
  Catch,
  HttpException,
  HttpStatus,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common'
import type { Response } from 'express'
import { DomainError } from './domain.error'

/**
 * Mapa código de dominio → HTTP status. Cada módulo agrega sus códigos.
 */
const STATUS_BY_CODE: Record<string, number> = {
  // 10-core-auth (v0.2.0)
  USER_NOT_FOUND: 404,
  EMAIL_ALREADY_EXISTS: 409,
  INVALID_CREDENTIALS: 401,
  USER_DISABLED: 401,
  SESSION_REVOKED: 401,
  SESSION_EXPIRED: 401,
  SESSION_NOT_FOUND: 404,
  INSUFFICIENT_PERMISSIONS: 403,
  WEAK_PASSWORD: 400,
  WRONG_OLD_PASSWORD: 400,

  // 20-intuit-oauth (v0.3.0)
  INTUIT_TOKENS_NOT_FOUND: 404,
  INTUIT_REFRESH_EXPIRED: 401,
  INTUIT_AUTH_ERROR: 400,
  INTUIT_BAD_REQUEST: 400,
  INTUIT_STATE_INVALID: 400,
  CLIENT_NOT_FOUND: 404,

  // 12-customer-support (v0.6.0)
  CLIENT_NOT_CONNECTED: 400,
  PUBLIC_LINK_INVALID: 404,
  PUBLIC_LINK_REVOKED: 410,
  PUBLIC_LINK_EXPIRED: 410,
  PUBLIC_LINK_PURPOSE_MISMATCH: 403,
  TRANSACTION_NOT_FOUND_IN_SNAPSHOT: 404,

  // 21-connections (v0.7.0) — reemplaza MICROSOFT_* de v0.6.2
  CONNECTION_NOT_FOUND: 404,
  CONNECTION_REFRESH_EXPIRED: 401,
  CONNECTION_AUTH_ERROR: 502,
  CONNECTION_STATE_INVALID: 400,
  PROVIDER_NOT_SUPPORTED: 400,
  PROVIDER_API_ERROR: 502,

  // 21-connections (v0.8.0)
  INTUIT_PERSONAL_CONNECTION_REQUIRED: 403,
}

interface ErrorBody {
  statusCode: number
  code: string
  message: string
  details?: Record<string, unknown>
}

/**
 * Filter global que homogeniza el formato de error JSON:
 * - DomainError → status según STATUS_BY_CODE (default 500).
 * - HttpException de Nest → status del exception, code derivado del nombre.
 * - Cualquier otro Error → 500 INTERNAL_ERROR (no expone stack).
 */
@Catch()
export class DomainErrorFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp()
    const res = ctx.getResponse<Response>()

    const body = this.buildBody(exception)
    res.status(body.statusCode).json(body)
  }

  private buildBody(exception: unknown): ErrorBody {
    if (exception instanceof DomainError) {
      const status = STATUS_BY_CODE[exception.code] ?? HttpStatus.INTERNAL_SERVER_ERROR
      return {
        statusCode: status,
        code: exception.code,
        message: exception.message,
        details: exception.details,
      }
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus()
      const response = exception.getResponse()
      const message =
        typeof response === 'string'
          ? response
          : ((response as { message?: string }).message ?? exception.message)
      return {
        statusCode: status,
        code: this.statusToCode(status),
        message,
      }
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_ERROR',
      message: 'Error interno del servidor',
    }
  }

  private statusToCode(status: number): string {
    switch (status) {
      case 400:
        return 'BAD_REQUEST'
      case 401:
        return 'UNAUTHORIZED'
      case 403:
        return 'FORBIDDEN'
      case 404:
        return 'NOT_FOUND'
      case 409:
        return 'CONFLICT'
      case 422:
        return 'UNPROCESSABLE_ENTITY'
      default:
        return status >= 500 ? 'INTERNAL_ERROR' : 'ERROR'
    }
  }
}
