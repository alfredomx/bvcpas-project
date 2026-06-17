import { PATH_METADATA } from '@nestjs/common/constants'
import { IntuitEntitiesController } from '@plugins/intuit/src/intuit-entities.controller'
import { IntuitReportsController } from '@plugins/intuit/src/intuit-reports.controller'
import { QBO_ENTITIES, QBO_REPORTS } from '@plugins/intuit/src/qbo-catalog'

/** Rutas `@Get(...)` declaradas en un controller (leídas de la metadata Nest). */
function routesOf(ctrl: new (...args: never[]) => object): string[] {
  const proto = ctrl.prototype as Record<string, unknown>
  return Object.getOwnPropertyNames(proto)
    .filter((n) => n !== 'constructor' && typeof proto[n] === 'function')
    .map((n) => Reflect.getMetadata(PATH_METADATA, proto[n] as object) as string | undefined)
    .filter((p): p is string => typeof p === 'string')
    .sort()
}

describe('catálogo QBO ↔ rutas registradas', () => {
  it('entidades: cada type tiene exactamente list + by-id (sin faltantes ni de más)', () => {
    const expected = QBO_ENTITIES.flatMap((e) => [
      `:clientId/${e.route}`,
      `:clientId/${e.route}/:id`,
    ])
    // ExchangeRate es GET dedicado (no list/by-id), va aparte del catálogo.
    expected.push(':clientId/exchange-rate')

    expect(routesOf(IntuitEntitiesController)).toEqual([...expected].sort())
  })

  it('reports: cada report del catálogo tiene su ruta dedicada (sin faltantes ni de más)', () => {
    const expected = QBO_REPORTS.map((r) => `:clientId/reports/${r.route}`)
    expect(routesOf(IntuitReportsController)).toEqual([...expected].sort())
  })

  it('no hay rutas ni nombres de entidad/report duplicados en el catálogo', () => {
    const eRoutes = QBO_ENTITIES.map((e) => e.route)
    const eNames = QBO_ENTITIES.map((e) => e.entity)
    const rRoutes = QBO_REPORTS.map((r) => r.route)
    const rNames = QBO_REPORTS.map((r) => r.name)
    expect(new Set(eRoutes).size).toBe(eRoutes.length)
    expect(new Set(eNames).size).toBe(eNames.length)
    expect(new Set(rRoutes).size).toBe(rRoutes.length)
    expect(new Set(rNames).size).toBe(rNames.length)
  })
})
