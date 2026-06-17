import type { INestApplication } from '@nestjs/common'
import jwt from 'jsonwebtoken'
import postgres from 'postgres'
import request from 'supertest'
import { setupTestApp } from '../_setup/test-app'

/**
 * E2E del CRUD de clientes. Corre contra `mapi_v2_local` (una sola DB por ahora,
 * D-core-025) y limpia las filas que crea en `afterAll`. Requiere `JWT_SECRET`
 * y la infra local viva.
 */
describe('clients CRUD (e2e)', () => {
  let app: INestApplication
  let token: string
  const createdIds: string[] = []

  beforeAll(async () => {
    app = await setupTestApp()
    token = jwt.sign({ sub: 'e2e', role: 'admin' }, process.env.JWT_SECRET as string)
  })

  afterAll(async () => {
    if (createdIds.length > 0) {
      const sql = postgres(process.env.DATABASE_URL as string, { max: 1 })
      try {
        await sql`DELETE FROM clients WHERE id = ANY(${createdIds})`
      } finally {
        await sql.end()
      }
    }
    await app.close()
  })

  it('rechaza con 401 sin token admin', async () => {
    const res = await request(app.getHttpServer()).get('/v1/clients')
    expect(res.status).toBe(401)
  })

  it('crea, lee, lista y edita un cliente', async () => {
    const legalName = `E2E Client ${Date.now()}`

    const created = await request(app.getHttpServer())
      .post('/v1/clients')
      .set('Authorization', `Bearer ${token}`)
      .send({ legalName })
    expect(created.status).toBe(201)
    expect(created.body.id).toBeDefined()
    expect(created.body.legalName).toBe(legalName)
    expect(created.body.status).toBe('active')
    const id = created.body.id as string
    createdIds.push(id)

    const got = await request(app.getHttpServer())
      .get(`/v1/clients/${id}`)
      .set('Authorization', `Bearer ${token}`)
    expect(got.status).toBe(200)
    expect(got.body.id).toBe(id)

    const listed = await request(app.getHttpServer())
      .get(`/v1/clients?search=${encodeURIComponent(legalName)}`)
      .set('Authorization', `Bearer ${token}`)
    expect(listed.status).toBe(200)
    expect(listed.body.total).toBeGreaterThanOrEqual(1)
    expect(listed.body.rows.some((r: { id: string }) => r.id === id)).toBe(true)

    const patched = await request(app.getHttpServer())
      .patch(`/v1/clients/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'paused', dba: 'E2E DBA' })
    expect(patched.status).toBe(200)
    expect(patched.body.status).toBe('paused')
    expect(patched.body.dba).toBe('E2E DBA')
  })

  it('404 al pedir un id inexistente', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/clients/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(404)
  })

  it('400 con body inválido (legal_name vacío)', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/clients')
      .set('Authorization', `Bearer ${token}`)
      .send({ legalName: '' })
    expect(res.status).toBe(400)
  })
})
