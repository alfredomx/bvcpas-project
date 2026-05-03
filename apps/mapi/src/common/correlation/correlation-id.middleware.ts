import { Injectable, type NestMiddleware } from '@nestjs/common'
import type { Request, Response, NextFunction } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { correlationStorage } from './correlation.context'

const HEADER = 'x-correlation-id'

/**
 * Middleware que asegura que cada request tenga un `correlation_id`:
 * - Si el cliente manda header `x-correlation-id`, se respeta.
 * - Si no, genera UUID v4.
 * - Lo expone en el response header (mismo nombre).
 * - Lo guarda en AsyncLocalStorage para que logs y código downstream lo lean.
 */
@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const incoming = req.headers[HEADER]
    const correlationId = typeof incoming === 'string' && incoming.length > 0 ? incoming : uuidv4()

    res.setHeader(HEADER, correlationId)

    correlationStorage.run({ correlationId }, () => {
      next()
    })
  }
}
