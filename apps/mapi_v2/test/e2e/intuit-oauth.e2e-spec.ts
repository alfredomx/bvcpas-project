import type { INestApplication } from '@nestjs/common'
import jwt from 'jsonwebtoken'
import postgres from 'postgres'
import request from 'supertest'
import { setupTestApp } from '../_setup/test-app'

/**
 * E2E del OAuth de Intuit (lado connect, sin pegarle a Intuit real). Crea un
 * client, pide la authorize URL y verifica que se arma bien. El callback real
 * necesita Intuit, así que no se e2e-testea aquí (cubierto por unit).
 */
describe('intuit OAuth connect (e2e)', () => {
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

  it('401 en connect sin token admin', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/intuit/oauth/connect')
      .send({ clientId: '00000000-0000-0000-0000-000000000000' })
    expect(res.status).toBe(401)
  })

  it('connect arma la authorize URL para un client existente', async () => {
    const created = await request(app.getHttpServer())
      .post('/v1/clients')
      .set('Authorization', `Bearer ${token}`)
      .send({ legalName: `E2E Intuit ${Date.now()}` })
    expect(created.status).toBe(201)
    const clientId = created.body.id as string
    createdIds.push(clientId)

    const res = await request(app.getHttpServer())
      .post('/v1/intuit/oauth/connect')
      .set('Authorization', `Bearer ${token}`)
      .send({ clientId })
    expect(res.status).toBe(201)
    const url = res.body.authorizeUrl as string
    expect(url).toContain('response_type=code')
    expect(url).toContain('state=')
    expect(url).toContain('client_id=')
    expect(url).toContain('redirect_uri=')
  })

  it('404 en connect con un client inexistente', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/intuit/oauth/connect')
      .set('Authorization', `Bearer ${token}`)
      .send({ clientId: '00000000-0000-0000-0000-000000000000' })
    expect(res.status).toBe(404)
  })
})
