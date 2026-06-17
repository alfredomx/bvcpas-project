import { configSchema } from '@/core/config/config.schema'

/**
 * Smoke test de la infra de jest + resolución del alias `@/`.
 * De paso fija el contrato del schema de config del core.
 */
describe('configSchema (core)', () => {
  it('acepta un env válido y aplica defaults', () => {
    const result = configSchema.safeParse({
      DATABASE_URL: 'postgresql://u:p@localhost:5433/db',
      REDIS_URL: 'redis://localhost:6379/3',
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.NODE_ENV).toBe('local')
      expect(result.data.PORT).toBe(4200)
      expect(result.data.LOG_LEVEL).toBe('info')
    }
  })

  it('rechaza cuando falta DATABASE_URL', () => {
    const result = configSchema.safeParse({ REDIS_URL: 'redis://localhost:6379/3' })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.join('.') === 'DATABASE_URL')).toBe(true)
    }
  })
})
