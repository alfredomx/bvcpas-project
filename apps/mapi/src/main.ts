import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { Logger } from '@nestjs/common'
import { AppModule } from './app.module'

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule)
  const port = Number(process.env.PORT) || 4000
  await app.listen(port)
  Logger.log(`mapi listening on http://localhost:${port}`, 'bootstrap')
}

bootstrap().catch((err: unknown) => {
  Logger.error('Failed to start mapi', err instanceof Error ? err.stack : String(err), 'bootstrap')
  process.exit(1)
})
