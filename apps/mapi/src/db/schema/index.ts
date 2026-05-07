// Re-export de todas las tablas del schema. Drizzle Kit lee este archivo
// (configurado en drizzle.config.ts) para generar migrations.
export * from './users'
export * from './user-sessions'
export * from './event-log'
export * from './clients'
export * from './client-transactions'
export * from './client-transaction-responses'
export * from './client-period-followups'
export * from './client-public-links'
export * from './user-connections'
export * from './user-client-access'
