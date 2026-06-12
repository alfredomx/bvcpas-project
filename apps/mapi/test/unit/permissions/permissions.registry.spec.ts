import {
  PERMISSIONS,
  PERMISSION_CODES,
  PERMISSION_CODES_SET,
  expandWildcard,
} from '../../../src/core/permissions/permissions.registry'

/**
 * Tests Tipo A — PermissionsRegistry.
 *
 * Cobertura:
 * - El catálogo no tiene duplicados.
 * - Todos los codes siguen el formato `<modulo>.<accion>` (al menos un punto).
 * - El registry coincide con `PERMISSION_CODES_SET` (mismo cardinal).
 * - `expandWildcard` resuelve `*`, `<modulo>.*`, `*.<accion>` y codes literales.
 * - `expandWildcard` con pattern desconocido devuelve array vacío.
 */
describe('PermissionsRegistry', () => {
  it('todos los codes son únicos', () => {
    const seen = new Set<string>()
    for (const p of PERMISSIONS) {
      expect(seen.has(p.code)).toBe(false)
      seen.add(p.code)
    }
    expect(seen.size).toBe(PERMISSIONS.length)
  })

  it('cada code tiene formato <modulo>.<accion>', () => {
    for (const p of PERMISSIONS) {
      // Al menos un punto que separa module de action.
      const parts = p.code.split('.')
      expect(parts.length).toBeGreaterThanOrEqual(2)
      // Todos los segmentos no vacíos.
      for (const seg of parts) {
        expect(seg.length).toBeGreaterThan(0)
      }
    }
  })

  it('PERMISSION_CODES_SET refleja PERMISSIONS sin pérdida', () => {
    expect(PERMISSION_CODES_SET.size).toBe(PERMISSIONS.length)
    for (const p of PERMISSIONS) {
      expect(PERMISSION_CODES_SET.has(p.code)).toBe(true)
    }
  })

  it('expandWildcard("*") devuelve todos los codes del catálogo', () => {
    const expanded = expandWildcard('*')
    expect(expanded.length).toBe(PERMISSIONS.length)
    expect(new Set(expanded)).toEqual(new Set(PERMISSION_CODES))
  })

  it('expandWildcard("banking.*") devuelve solo permisos del módulo banking', () => {
    const expanded = expandWildcard('banking.*')
    expect(expanded.length).toBeGreaterThan(0)
    for (const code of expanded) {
      expect(code.startsWith('banking.')).toBe(true)
    }
    // No falta ninguno: verificar contra el registry.
    const expected = PERMISSIONS.filter((p) => p.code.startsWith('banking.')).map((p) => p.code)
    expect(new Set(expanded)).toEqual(new Set(expected))
  })

  it('expandWildcard("*.read") devuelve solo permisos terminados en .read', () => {
    const expanded = expandWildcard('*.read')
    expect(expanded.length).toBeGreaterThan(0)
    for (const code of expanded) {
      expect(code.endsWith('.read')).toBe(true)
    }
    const expected = PERMISSIONS.filter((p) => p.code.endsWith('.read')).map((p) => p.code)
    expect(new Set(expanded)).toEqual(new Set(expected))
  })

  it('expandWildcard con code literal válido devuelve [code]', () => {
    const expanded = expandWildcard('banking.delete')
    expect(expanded).toEqual(['banking.delete'])
  })

  it('expandWildcard con pattern desconocido devuelve array vacío', () => {
    const expanded = expandWildcard('not.a.real.code')
    expect(expanded).toEqual([])
  })

  it('expandWildcard con wildcard sin match devuelve array vacío', () => {
    const expanded = expandWildcard('nonexistent.*')
    expect(expanded).toEqual([])
  })

  it('cada módulo del registry tiene al menos un permiso .read', () => {
    // Importante porque el rol Viewer del sistema se basa en *.read — si
    // un módulo no tiene .read, el Viewer no puede ver nada de él.
    const modulesWithoutRead = new Set<string>()
    const modulesSeen = new Set<string>()
    for (const p of PERMISSIONS) {
      modulesSeen.add(p.module)
    }
    for (const m of modulesSeen) {
      const hasRead = PERMISSIONS.some((p) => p.module === m && p.code.endsWith('.read'))
      if (!hasRead) modulesWithoutRead.add(m)
    }
    // `system` es excepción: tiene `system.users.manage`, `system.roles.manage`,
    // `system.permissions.manage` (sin `.read`). El rol Viewer NO debe poder
    // gestionar usuarios/roles/permisos, lo cual es correcto.
    expect(modulesWithoutRead).toEqual(new Set(['system']))
  })
})
