#!/usr/bin/env node
// Helper para lint-staged: corre eslint local de la app con archivos staged.
//
// Uso: node scripts/run-eslint.mjs <app-dir> <file1> <file2> ...
//
// lint-staged pasa los archivos como paths absolutos al final del comando.
// Esto los convierte a relativos al app-dir y ejecuta el eslint instalado
// dentro de esa app (no requiere eslint global en raíz).

import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { relative, resolve } from 'node:path'

const [, , appDir, ...files] = process.argv

if (!appDir) {
  console.error('[run-eslint] missing app dir argument')
  process.exit(1)
}

const repoRoot = process.cwd()
const appAbs = resolve(repoRoot, appDir)

if (!existsSync(appAbs)) {
  console.error(`[run-eslint] app dir not found: ${appAbs}`)
  process.exit(1)
}

if (files.length === 0) {
  process.exit(0)
}

const relFiles = files.map((f) => relative(appAbs, resolve(f)))

const eslintBin = resolve(
  appAbs,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'eslint.cmd' : 'eslint',
)

if (!existsSync(eslintBin)) {
  console.error(
    `[run-eslint] eslint not installed in ${appDir}. Run: cd ${appDir} && npm install`,
  )
  process.exit(1)
}

const result = spawnSync(
  eslintBin,
  ['--max-warnings=0', '--no-warn-ignored', '--config', `eslint.config.mjs`, ...relFiles],
  {
    cwd: appAbs,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  },
)

if (result.error) {
  console.error('[run-eslint] spawn error:', result.error.message)
  process.exit(1)
}

process.exit(result.status ?? 1)
