# Flujo — Descarga bancaria (step-flow con auto-login)

Convierte "descarga de chase todos los cheques de este mes" en pasos. Pensado como tools de un
conector (Claude) y, hoy, como REST que consume el frontend.

**Módulo backend**: `22-bank-worker` (v0.21.0). **Tag Scalar**: `Banking - Download`.

**Pre-requisitos en vivo**: el plugin (kiro ≥ v0.5.0, con `open_tab`) conectado al bridge. El banco
NO tiene que estar logueado de antemano — si no hay sesión, mapi hace auto-login con las credenciales
del vault. Device-trust/MFA del banco quedan fuera (se asume dispositivo confiable).

---

## Paso 0 — Resolver el cliente (11-clients)

El caller traduce "arcmen"/"bilia" → `clientId` (alias + fuzzy). No es de este flujo.

---

## Paso 1 — Elegir credencial (vault)

```
GET /v1/clients/:id/banking/download/credentials?portal=chase
Authorization: Bearer <JWT admin>          (banking.read)
```

Devuelve las credenciales del cliente (portal, nickname, `download_supported`). **Sin secretos.**
Úsalo solo si el cliente tiene varias credenciales en el portal (p.ej. 2 logins RBFCU) para elegir
`credential_id`. Las **cuentas** NO salen de aquí (el operador no las registra) — van en el paso 2.

---

## Paso 2 — Auto-login + cuentas EN VIVO

```
POST /v1/clients/:id/banking/download/accounts
Authorization: Bearer <JWT admin>          (banking.read)
{ "credentialId": "uuid" }
```

Qué hace mapi:

1. Intenta `getAllAccounts()` (fast path). Si ya hay sesión → devuelve cuentas sin loguear.
2. Si no hay sesión: `list_tabs` → ¿hay pestaña del logonbox de Chase? **sí** la usa / **no** `open_tab(URL logonbox)` → manda la receta de login (`execute_dom`: fill user/pass + click signin, creds del vault) → poll `getAllAccounts()` hasta que la sesión responde.

Respuesta `200`:

```json
{
  "credential_id": "uuid",
  "portal": "Chase",
  "today": "06-14-2026",
  "timezone": "America/Chicago",
  "accounts": [
    { "mask": "8250", "type": "checking", "name": "Operating" },
    { "mask": "9000", "type": "credit", "name": "Card" }
  ]
}
```

- El conector muestra el picker: `1- checking 8250 / 2- savings ... / N- todas`.
- `today` es el **ancla**: con él el modelo traduce "del mes pasado a la fecha" → `from`/`to`
  explícitos en el paso 3 (los LLM no saben con certeza qué día es hoy).

Errores: `404` (credencial), `501` (portal sin adapter o sin login), `502` (sesión no establecida:
login/MFA/banco), `503` (sin plugin).

---

## Paso 3 — Descargar cheques (N cuentas)

```
POST /v1/clients/:id/banking/download/checks
Authorization: Bearer <JWT admin>          (banking.read)
```

```json
{ "credentialId": "uuid", "accountMasks": ["8250", "9000"], "range": "this_month" }
```

```json
{ "credentialId": "uuid", "accountMasks": ["8250"], "from": "05-01-2026", "to": "06-14-2026" }
```

Reglas:

- **`accountMasks`**: array (≥1) de las masks elegidas en el paso 2. "Todas" = mandar todas.
- **Rango**: exactamente uno de `range` (preset) **o** `from`+`to` (MM-DD-YYYY).
- **Presets** (inglés): `today, yesterday, last_7_days, last_week, last_30_days, this_month,
last_month, this_year, last_year`. Se resuelven a MM-DD-YYYY en la zona del cliente.
  - `last_week` = semana calendario anterior **domingo→sábado**.
- **Custom range**: el conector computa `from`/`to` con el `today` del paso 2.

Respuesta `200`:

```json
{
  "credential_id": "uuid",
  "portal": "Chase",
  "range": { "from": "06-01-2026", "to": "06-14-2026" },
  "accounts": [
    {
      "account_mask": "8250",
      "count": 2,
      "checks": [
        {
          "sequenceNumber": "C1",
          "type": "CHECK",
          "frontImageBase64": "...",
          "rearImageBase64": "..."
        }
      ]
    },
    { "account_mask": "9000", "count": 0, "checks": [] }
  ],
  "total_checks": 2
}
```

Emite el evento `bank.checks.downloaded`. Errores: `404` (credencial / mask no existe en el banco),
`501` (sin adapter), `502` (el banco falló), `503` (sin plugin).

---

## Notas operativas

- **Por qué pasos y no un `login()`**: cada paso es una operación reusable; `download_checks` corre
  sobre N cuentas (todas o las elegidas) en una sola llamada.
- **Selecciono "todas" y una cuenta no tiene cheques** → regresa `count: 0`, sin error.
- **Solo Chase hoy**: otros bancos → `501` hasta portar su adapter (mismo patrón Design B).
- **El login** corre con `execute_dom` (kiro tonto); la receta (URL logonbox + selectores) vive en el
  adapter de mapi, validada en vivo. `open_tab` (kiro v0.5.0) cubre "abrir la pestaña si no hay".
