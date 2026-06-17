# plugins

Aquí vive cada plugin de `mapi_v2`. Un plugin = una talacha (descarga de banco, uncats, posting a QBO, etc.) que usa el `core` sin tocarlo.

> Arquitectura host+plugins, reglas y cómo se enchufa un plugin al core: [`../README.md`](../README.md).

Cada plugin es su propio proyecto:

```
plugins/<plugin>/
├── src/           ← su código (usa la API pública del core vía servicios inyectados)
├── CONTRACT.md    ← la cara pública: qué hace, in/out, endpoints. NO el cómo.
└── roadmap/       ← versiones + TDD del plugin
```

**Regla:** un plugin nunca importa el core internals ni otro plugin. Se comunica con otros plugins por cola + contrato. El core lo monta por el registro; no lo conoce por nombre.

Plugins planeados (se crean cuando se construye cada uno):

- `bank` 📅 — descarga de cheques/depósitos/estados vía plugin-bridge.
- `uncats` 📅 — snapshot de uncategorized + flujo de respuestas del cliente.
