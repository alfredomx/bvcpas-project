import type { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { setupTestApp } from '../_setup/test-app'

/**
 * E2E de la unit de ejemplo: prueba que el registro montó el plugin y que su
 * config propia se inyectó (el greeting viene de `EXAMPLE_GREETING`).
 *
 * Levanta el AppModule completo, así que requiere la infra local viva
 * (redis para BullMQ). No toca DB.
 */
describe('_example plugin (e2e)', () => {
  let app: INestApplication

  beforeAll(async () => {
    app = await setupTestApp()
  })

  afterAll(async () => {
    await app.close()
  })

  it('GET /v1/_example/ping monta la unit y devuelve su config inyectada', async () => {
    const res = await request(app.getHttpServer()).get('/v1/_example/ping')

    expect(res.status).toBe(200)
    expect(res.body.unit).toBe('_example')
    expect(typeof res.body.greeting).toBe('string')
    expect(res.body.greeting.length).toBeGreaterThan(0)
  })
})
