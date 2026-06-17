# BACKLOG — `core`

Cosas diferidas a propósito. Cuando llegue el trigger, se retoman y se mueven al roadmap de la versión que las trabaja.

> Cuando difieras algo durante una versión, además de mencionarlo en su `vX.Y.Z.md`, agrega una línea aquí agrupada por su trigger.

## Bloqueado por: primer plugin real (`intuit`)

- [ ] **`plugins/intuit` — primer plugin (su propia unidad/roadmap).** Lleva qbo-client (HTTP a QBO V3 + refresh), OAuth, y su tabla propia `intuit_tokens` (`client_id` FK + `realm_id` + tokens encriptados), config `INTUIT_*` (con su Zod propio). **Consume `clients` del core** (no es dueño de esa tabla — revisado: `clients` se promovió al core, ver D-core-021). Valida la API pública del core y el contrato de inserción end-to-end. (D-core-015 + D-core-021)
- [ ] **Convención de migraciones por plugin.** Un solo Postgres con tablas de varios plugins necesita una convención (carpetas de migración por plugin / orden). Se aterriza con el primer plugin que cree tablas (intuit).
- [ ] **Errores de plugin:** verificar que `intuit` declara sus `DomainError` con `code` + `status` propio (D-core-011) y que el `DomainErrorFilter` los homogeniza bien (status correcto, `correlation_id` en el body). No hay registro central de códigos.

## Bloqueado por: segundo plugin real

- [ ] **Loader dinámico (auto-discovery).** Hoy el registro es una lista explícita (D-core-014). Endurecer a descubrimiento dinámico SOLO si con 2 plugins reales (intuit + bank) el contrato común ya está claro y la lista explícita estorba.
- [ ] **Health por plugin.** Agregar al `/v1/healthz` los probes opcionales que cada plugin/pipe contribuya vía el registro. Hoy healthz solo checa el core (db + redis).

## Bloqueado por: financiamiento de multiusuario

- [ ] Identidad/tenancy (usuarios, sesiones, multi-cuenta, gateway externo). Hoy: un operador único + token admin. Ver [`../../README.md`](../../README.md) — frontera motor/identidad.

## Bloqueado por: necesidad de auditoría formal

- [ ] **`event_log` en el core.** Tabla + servicio de auditoría ("quién creó/editó/dio de baja qué", con `actor` cuando haya identidad). Hoy los cambios solo se loguean por Pino con `correlation_id`. mapi viejo sí tenía `event_log`. Trigger: cuando se necesite rastrear cambios de forma consultable (típico: ediciones/bajas de `clients`, acciones que escriben a QBO). Diferido en core v0.2.0 (clients).

## Por triggear con un evento concreto

- [ ] **Validación automática (nestjs-zod):** hoy la validación es por-ruta con `new ZodValidationPipe(schema)`; si un endpoint la olvida, el body inválido pasa sin validar y puede explotar en 500 (mismo bug que cazó a mapi). Trigger: cuando un plugin tenga muchos DTOs y queramos `ZodValidationPipe` global automático (patrón `createZodDto` de nestjs-zod).
