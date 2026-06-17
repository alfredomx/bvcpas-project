import { z } from 'zod'
import { assertRegistryConfig, registryModules } from '@/registry/registry'
import type { ModuleDef } from '@/registry/module-def'

class FakeModule {}

function def(partial: Partial<ModuleDef> = {}): ModuleDef {
  return { name: 'fake', type: 'plugin', module: FakeModule, ...partial }
}

describe('assertRegistryConfig', () => {
  it('no lanza cuando no hay units', () => {
    expect(() => assertRegistryConfig([], {})).not.toThrow()
  })

  it('no lanza cuando las units no declaran config', () => {
    expect(() => assertRegistryConfig([def(), def({ name: 'otra' })], {})).not.toThrow()
  })

  it('lanza listando la var faltante con el nombre de la unit', () => {
    const unit = def({ name: 'intuit', config: z.object({ INTUIT_CLIENT_ID: z.string() }) })
    expect(() => assertRegistryConfig([unit], {})).toThrow(/\[intuit\].*INTUIT_CLIENT_ID/s)
  })

  it('agrega violaciones de varias units en un solo error', () => {
    const a = def({ name: 'a', config: z.object({ A_VAR: z.string() }) })
    const b = def({ name: 'b', config: z.object({ B_VAR: z.string() }) })

    let message = ''
    try {
      assertRegistryConfig([a, b], {})
    } catch (e) {
      message = (e as Error).message
    }

    expect(message).toContain('[a]')
    expect(message).toContain('A_VAR')
    expect(message).toContain('[b]')
    expect(message).toContain('B_VAR')
  })

  it('pasa cuando la config se satisface', () => {
    const unit = def({ name: 'ok', config: z.object({ OK_VAR: z.string() }) })
    expect(() => assertRegistryConfig([unit], { OK_VAR: 'x' })).not.toThrow()
  })
})

describe('registryModules', () => {
  it('mapea cada unit a su módulo, en orden', () => {
    class M1 {}
    class M2 {}
    const mods = registryModules([def({ module: M1 }), def({ module: M2 })])
    expect(mods).toEqual([M1, M2])
  })

  it('devuelve lista vacía para registro vacío', () => {
    expect(registryModules([])).toEqual([])
  })
})
