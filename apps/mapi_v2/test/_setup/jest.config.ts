import type { Config } from 'jest'

/**
 * Jest config para tests unitarios (Tipo A): lógica pura, sin DB ni red.
 *
 * Los tests viven en `test/unit/<area>/<archivo>.spec.ts`. ts-jest compila
 * con `tsconfig.spec.json` (trae los tipos de jest y relaja noUnusedLocals).
 *
 * Alias resueltos igual que en runtime: `@/` → core/src, `@plugins/<x>` →
 * plugins/<x>/src.
 *
 * Para tests E2E (Tipo B: levantan la app), ver `jest-e2e.json`.
 */
const config: Config = {
  rootDir: '../..',
  roots: ['<rootDir>/test/unit'],
  testRegex: '.*\\.spec\\.ts$',
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/test/e2e/'],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
      },
    ],
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/core/src/$1',
    '^@plugins/(.*)$': '<rootDir>/plugins/$1/src',
  },
  collectCoverageFrom: [
    'core/src/**/*.ts',
    'plugins/**/src/**/*.ts',
    'pipes/**/src/**/*.ts',
    '!**/*.spec.ts',
    '!**/*.module.ts',
    '!core/src/main.ts',
  ],
  coverageDirectory: '<rootDir>/coverage',
  testEnvironment: 'node',
  clearMocks: true,
}

export default config
