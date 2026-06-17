import { Module } from '@nestjs/common'
import { ExampleController } from './_example.controller'
import { EXAMPLE_CONFIG, exampleConfigSchema } from './_example.config'

/**
 * NestModule del plugin `_example`. Trae lo suyo: su controller y su config
 * (parseada con su propio Zod, espejo de cómo el core hace `AppConfigModule`).
 * No toca entrañas del core ni de otro plugin.
 */
@Module({
  controllers: [ExampleController],
  providers: [
    {
      provide: EXAMPLE_CONFIG,
      useFactory: () => exampleConfigSchema.parse(process.env),
    },
  ],
})
export class ExampleModule {}
