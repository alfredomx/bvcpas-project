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
 * Mapa código de dominio → HTTP status. Vacío en Fundación. Cada módulo
 * agrega sus códigos cuando entran.
 *
 * Ejemplo futuro:
 *   CLIENT_NOT_FOUND: 404
 *   INTUIT_TOKEN_EXPIRED: 401
 */
const STATUS_BY_CODE: Record<string, number> = {}

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
