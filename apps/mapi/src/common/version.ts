import { readFileSync } from 'node:fs'
import { join } from 'node:path'

interface PackageJson {
  name: string
  version: string
}

/**
 * Lee `package.json` de la app al arranque para exponer nombre y versión
 * en endpoints como /healthz y /metrics. Fail-fast si no se puede leer
 * (síntoma de packaging roto).
 */
function readPackage(): PackageJson {
  const path = join(process.cwd(), 'package.json')
  const raw = readFileSync(path, 'utf-8')
  const parsed = JSON.parse(raw) as PackageJson
  return parsed
}

const pkg = readPackage()

export const APP_NAME = pkg.name
export const APP_VERSION = pkg.version
