import {
  Catch,
  HttpException,
  HttpStatus,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common'
import type { Response } from 'express'
import { DomainError } from './domain.error'
import { getCorrelationId } from '@/common/correlation/correlation.context'

interface ErrorBody {
  statusCode: number
  code: string
  message: string
  correlation_id?: string
  details?: Record<string, unknown>
}

/**
 * Filter global que homogeniza el formato de error JSON:
 * - DomainError → status que el propio error declara (no hay mapa central; el
 *   core es ciego a los códigos de los plugins, D-core-001/011).
 * - HttpException de Nest → status del exception, code derivado del status.
 * - Cualquier otro Error → 500 INTERNAL_ERROR (no expone stack).
 *
 * En todas las respuestas incluye el `correlation_id` del request para que un
 * error visto por el cliente se pueda cruzar con los logs de Pino.
 */
@Catch()
export class DomainErrorFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp()
    const res = ctx.getResponse<Response>()

    const body = this.buildBody(exception)
    const correlationId = getCorrelationId()
    if (correlationId) body.correlation_id = correlationId

    res.status(body.statusCode).json(body)
  }

  private buildBody(exception: unknown): ErrorBody {
    if (exception instanceof DomainError) {
      return {
        statusCode: exception.status,
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
