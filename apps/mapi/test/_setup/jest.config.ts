import type { Config } from 'jest'

/**
 * Jest config para tests Tipo A (lógica pura con fixtures JSON).
 *
 * NO toca DB. Los services reciben mocks de los repositorios; los
 * repositorios reciben fixtures JSON capturados de queries reales.
 *
 * Costo: milisegundos por test. Permite ciclo TDD-first real.
 *
 * Ubicación de tests: `apps/mapi/test/unit/<area>/<archivo>.spec.ts`.
 * Ubicación de fixtures: `apps/mapi/test/fixtures/<area>/<caso>.json`.
 *
 * Para tests Tipo B (smoke con DB real), ver `jest-e2e.json`.
 */
const config: Config = {
  rootDir: '../..',
  roots: ['<rootDir>/test/unit', '<rootDir>/src'],
  testRegex: '.*\\.spec\\.ts$',
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/test/e2e/'],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.json',
      },
    ],
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.spec.ts', '!src/**/*.module.ts', '!src/main.ts'],
  coverageDirectory: '<rootDir>/coverage',
  testEnvironment: 'node',
  clearMocks: true,
}

export default config
