import { EventLogService } from '../../../src/modules/95-event-log/event-log.service'
import type { DrizzleDb } from '../../../src/core/db/db.module'

/**
 * Tests Tipo A para EventLogService.
 *
 * Cobertura:
 * - CR-auth-043: si insert falla, log() NO propaga error al caller.
 * - log() llama a db.insert con shape correcto cuando se le pasan
 *   payload, actorUserId, resource.
 */

interface InsertedRow {
  eventType: string
  actorUserId: string | null
  resourceType: string | null
  resourceId: string | null
  payload: Record<string, unknown>
}

function buildMockDb(opts: { failOnInsert?: boolean } = {}): {
  db: DrizzleDb
  inserted: InsertedRow[]
} {
  const inserted: InsertedRow[] = []

  const db = {
    insert: () => ({
      values: (row: InsertedRow) => {
        if (opts.failOnInsert) {
          return Promise.reject(new Error('DB connection lost'))
        }
        inserted.push(row)
        return Promise.resolve()
      },
    }),
  } as unknown as DrizzleDb

  return { db, inserted }
}

describe('EventLogService', () => {
  describe('log (happy path)', () => {
    it('inserta row con eventType y payload', async () => {
      const { db, inserted } = buildMockDb()
      const service = new EventLogService(db)

      await service.log('auth.login.success', { ip: '127.0.0.1' })

      expect(inserted).toHaveLength(1)
      expect(inserted[0].eventType).toBe('auth.login.success')
      expect(inserted[0].payload).toEqual({ ip: '127.0.0.1' })
    })

    it('inserta con actorUserId cuando se proporciona', async () => {
      const { db, inserted } = buildMockDb()
      const service = new EventLogService(db)

      await service.log('auth.user.created', { email: 'a@b.com' }, 'user-123')

      expect(inserted[0].actorUserId).toBe('user-123')
    })

    it('inserta con resource cuando se proporciona', async () => {
      const { db, inserted } = buildMockDb()
      const service = new EventLogService(db)

      await service.log('auth.user.updated', {}, 'user-1', { type: 'user', id: 'user-2' })

      expect(inserted[0].resourceType).toBe('user')
      expect(inserted[0].resourceId).toBe('user-2')
    })

    it('actorUserId default es null cuando NO se pasa', async () => {
      const { db, inserted } = buildMockDb()
      const service = new EventLogService(db)

      await service.log('auth.login.failed', { email: 'x@y.com' })

      expect(inserted[0].actorUserId).toBeNull()
    })

    it('payload default es {} cuando NO se pasa', async () => {
      const { db, inserted } = buildMockDb()
      const service = new EventLogService(db)

      await service.log('auth.logout')

      expect(inserted[0].payload).toEqual({})
    })
  })

  describe('log (CR-auth-043: swallow errors)', () => {
    it('NO propaga error cuando db.insert falla', async () => {
      const { db } = buildMockDb({ failOnInsert: true })
      const service = new EventLogService(db)

      await expect(service.log('auth.login.success', {})).resolves.toBeUndefined()
    })
  })
})
