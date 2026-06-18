# `plugins/bank-credentials`

Plugin de dominio de `mapi_v2`. Guarda las **credenciales bancarias** de los clientes del despacho (catálogo de portales + logins cifrados + cuentas individuales) para que el operador entre a los bancos. Es **almacenamiento**: NO descarga transacciones (eso vive en la extensión de Chrome / qubot).

- Se monta en el core por el registro (`bankCredentialsPlugin`, un `ModuleDef`).
- Consume del core: `DB`, `EncryptionService`, `clients` (FK). Cero reach a otros plugins.
- Dueño de sus 3 tablas, rutas (`/v1/bank/*`) y errores.

**Roadmap, proceso y decisiones:** [`roadmap/README.md`](roadmap/README.md).
