import { Controller, Get, Inject } from '@nestjs/common'
import { EXAMPLE_CONFIG, type ExampleConfig } from './_example.config'

/**
 * Ruta de prueba del plugin de ejemplo. Con el prefijo global `/v1`, queda en
 * `GET /v1/_example/ping`. Devolver el greeting de la config prueba dos cosas:
 * que la unit se montó y que su config propia se inyectó.
 */
@Controller('_example')
export class ExampleController {
  constructor(@Inject(EXAMPLE_CONFIG) private readonly config: ExampleConfig) {}

  @Get('ping')
  ping(): { unit: string; greeting: string } {
    return { unit: '_example', greeting: this.config.EXAMPLE_GREETING }
  }
}
