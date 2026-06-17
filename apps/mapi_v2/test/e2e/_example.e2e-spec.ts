import type { INestApplication } from '@nestjs/common'
import jwt from 'jsonwebtoken'
import request from 'supertest'
import { setupTestApp } from '../_setup/test-app'

/**
 * E2E del plugin de ejemplo. Prueba dos cosas:
 * 1. El registro montó el plugin y su config propia se inyectó (greeting).
 * 2. El `AdminGuard` global protege la ruta: sin token → 401, con token → 200.
 *
 * Levanta el AppModule completo, así que requiere la infra local viva
 * (redis para BullMQ) y `JWT_SECRET` en el env. No toca DB.
 */
describe('_example plugin (e2e)', () => {
  let app: INestApplication
  let token: string

  beforeAll(async () => {
    app = await setupTestApp()
    // Firma un token admin con el mismo secreto que valida el guard.
    token = jwt.sign({ sub: 'e2e', role: 'admin' }, process.env.JWT_SECRET as string)
  })

  afterAll(async () => {
    await app.close()
  })

  it('rechaza con 401 si no hay token admin', async () => {
    const res = await request(app.getHttpServer()).get('/v1/_example/ping')
    expect(res.status).toBe(401)
  })

  it('con token admin monta el plugin y devuelve su config inyectada', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/_example/ping')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.plugin).toBe('_example')
    expect(typeof res.body.greeting).toBe('string')
    expect(res.body.greeting.length).toBeGreaterThan(0)
  })
})
