// Re-export de todas las tablas del core. Drizzle Kit lee este archivo
// (configurado en drizzle.config.ts) para generar las migraciones.
//
// OJO: aquí van SOLO las tablas del core. Cada plugin/pipe declara sus tablas
// en su propia carpeta y su propia config de migración (convención por plugin
// pendiente en BACKLOG; se aterriza con el primer plugin).
export * from './clients'
