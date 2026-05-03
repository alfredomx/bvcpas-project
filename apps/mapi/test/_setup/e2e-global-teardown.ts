/**
 * Global teardown para tests Tipo B.
 *
 * Por ahora no hace nada (los tests dejan rastros en mapi_test que se
 * limpian con DROP TABLE en próximo run o manualmente).
 *
 * Si en el futuro se requiere limpieza estricta entre runs (CI), agregar
 * aquí DROP TABLE o TRUNCATE.
 */
export default async function globalTeardown(): Promise<void> {
  // intencionalmente vacío
}
