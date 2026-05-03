import { BadRequestException, type PipeTransform } from '@nestjs/common'
import type { ZodSchema } from 'zod'

/**
 * Pipe genérico que valida body/query/param contra un schema Zod.
 *
 * Uso:
 *   @Body(new ZodValidationPipe(CreateClientSchema))
 *
 * Si la validación falla, lanza BadRequestException con la lista de
 * issues de Zod (path + message).
 */
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value)
    if (!result.success) {
      throw new BadRequestException({
        message: 'Validation failed',
        issues: result.error.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      })
    }
    return result.data
  }
}
