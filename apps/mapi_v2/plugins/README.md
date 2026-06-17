# plugins

Aquí vive cada plugin de `mapi_v2`. Un plugin = una **integración de dominio** (Intuit, banco, uncats, posting a QBO, etc.) que usa el `core` sin tocarlo.

> Arquitectura core+plugins+pipes, reglas y cómo se inserta un plugin: [`../README.md`](../README.md).

Cada plugin es su propio proyecto y **dueño de lo suyo**:

```
plugins/<plugin>/
├── src/           ← su código (API pública del core vía servicios inyectados); SUS tablas + SUS migraciones + SU config Zod + SUS errores
├── README.md      ← la cara pública: qué hace, in/out, endpoints. NO el cómo.
└── roadmap/       ← versiones + TDD del plugin
```

**Regla:** un plugin nunca importa el core internals ni otro plugin. Se comunica con otros por cola + contrato. El core lo monta agregándolo a la lista del registro; no lo conoce por nombre.

Plugins planeados (se crean cuando se construye cada uno):

- `intuit` 📅 — **primer plugin.** OAuth + tokens QBO + tabla `clients` + `qbo-client` (HTTP a QBO V3 con refresh) + config `INTUIT_*`. Todo lo de QuickBooks vive aquí, no en el core.
- `bank` 📅 — descarga de cheques/depósitos/estados vía bridge.
- `uncats` 📅 — snapshot de uncategorized + flujo de respuestas del cliente.
