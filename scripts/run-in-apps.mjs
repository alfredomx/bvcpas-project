#!/usr/bin/env node
/**
 * Orquestador de scripts cross-app.
 *
 * Uso: node scripts/run-in-apps.mjs <script-name>
 *
 * Ejemplos:
 *   node scripts/run-in-apps.mjs typecheck
 *   node scripts/run-in-apps.mjs lint
 *   node scripts/run-in-apps.mjs format:check
 *
 * Comportamiento:
 *   - Itera sobre apps/mapi, apps/web, apps/kiro.
 *   - Si la app NO existe (carpeta inexistente o sin package.json) → la salta silenciosamente.
 *     Esto permite que el repo arranque con apps incompletas durante P0.
 *   - Si la app existe pero el script no está definido en su package.json → la salta con warning.
 *   - Si la app existe y el script falla → propaga exit code != 0 (para que pre-commit lo bloquee).
 *
 * Razón: durante P0 las apps se crean en sub-etapas (P0.3 mapi, P0.7 web, P0.8 kiro). Los
 * scripts raíz (typecheck, lint, format) deben funcionar incluso cuando solo existe alguna.
 */

import { existsSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

const APPS = ['apps/mapi', 'apps/web', 'apps/kiro']
const scriptName = process.argv[2]

if (!scriptName) {
  console.error('Uso: node scripts/run-in-apps.mjs <script-name>')
  process.exit(1)
}

let failedApp = null

for (const app of APPS) {
  const appPath = resolve(process.cwd(), app)
  const pkgJsonPath = resolve(appPath, 'package.json')

  // Skip silenciosamente si la app no existe todavía
  if (!existsSync(appPath) || !existsSync(pkgJsonPath)) {
    continue
  }

  // Verificar que el script está definido en el package.json de la app
  const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf8'))
  if (!pkg.scripts?.[scriptName]) {
    console.warn(`[run-in-apps] ${app}: script "${scriptName}" no definido, saltando`)
    continue
  }

  console.log(`\n[run-in-apps] ${app}: npm run ${scriptName}`)

  const result = spawnSync('npm', ['run', scriptName], {
    cwd: appPath,
    stdio: 'inherit',
    shell: true,
  })

  if (result.status !== 0) {
    failedApp = app
    break
  }
}

if (failedApp) {
  console.error(`\n[run-in-apps] FALLÓ en ${failedApp}. Aborta.`)
  process.exit(1)
}

console.log(`\n[run-in-apps] OK (${scriptName})`)
