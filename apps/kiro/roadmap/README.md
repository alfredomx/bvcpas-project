# Roadmap — `kiro` (Chrome extension Manifest v3)

Plan y estado de cada módulo y versión del plugin `kiro` dentro de `bvcpas-project`. Estructura: una **carpeta por módulo** (numerada `NN-nombre`) con su `README.md` (TDD vivo del módulo) + uno o varios archivos `vX.Y.Z.md` (bitácora de cada versión). Es la **fuente de verdad** para qué se hizo, qué se está haciendo y qué falta.

> **Si eres un modelo (Claude u otro) iniciando sesión nueva sobre el plugin**: lee este README + el TDD del módulo en estado `🚧` (si hay) + el `vX.Y.Z.md` activo + `README.md` raíz del repo.

> **Items diferidos**: ver [`BACKLOG.md`](BACKLOG.md).

> **Roadmap de los otros apps**: cada app de `bvcpas-project` versiona independiente.
>
> - Backend: [`../../mapi/roadmap/`](../../mapi/roadmap/README.md)
> - Frontend: [`../../bvcpas/roadmap/`](../../bvcpas/roadmap/README.md)

---

## Estado actual

**Módulo activo:** ninguno (00-foundation cerrado en v0.1.0 el 2026-05-03 con scaffold mínimo).
**Siguiente:** `10-bridge-client/` (P2 — WebSocket client + auth con mapi). Depende de que `apps/mapi/roadmap/20-intuit/02-bridge/` tenga gateway listo.

> **Producto, filosofía y plan Mx:** ver [`docs/README.md`](../../../docs/README.md) (cross-app).

---

## Estructura de la carpeta

```
apps/kiro/roadmap/
├── README.md                       ← este archivo (índice + reglas + decisiones)
├── BACKLOG.md                      ← items diferidos por trigger
├── 00-foundation/                  ← bootstrap ✅ v0.1.0
│   ├── README.md
│   └── v0.1.0.md
├── 10-bridge-client/               ← P2 — WebSocket client + auth con mapi
│   └── README.md
├── 20-qbo-scripts/                 ← content scripts QBO (Mx que requieren plugin)
│   ├── README.md                   ← TDD del bloque
│   └── m2-uncats-write/            ← M2 — escribe notas/memo en QBO
├── 30-banks/                       ← (M4 futuro: scraping bank statements, si entra)
└── 40-receipts/                    ← (M5 futuro: upload directo de recibos, si entra)
```

### Numeración por dominio

A diferencia de `mapi` (donde la numeración es 1:1 con `src/modules/`), en `kiro` la estructura del código de Chrome extension no se organiza por módulos numerados nativamente. La numeración aquí en `roadmap/` agrupa por dominio funcional para mantener consistencia con el resto del proyecto:

| Decena | Dominio                                                |
| ------ | ------------------------------------------------------ |
| 0x     | Infra/bootstrap (`00-foundation`)                      |
| 1x     | Comunicación con mapi (bridge client, auth, reconnect) |
| 2x     | Content scripts / detección QBO / queries internas     |
| 3x+    | Libre (popup UI, settings, distribución, etc.)         |

**Unidades dejan hueco** para insertar dominios sin renombrar.

---

## Versionado SemVer

Versiones siguen [SemVer](https://semver.org/lang/es/):

- `MAJOR.MINOR.PATCH` — `0.2.0`, `1.2.5`, etc.
- **MAJOR** — cambios incompatibles. No hay v1.0.0 todavía.
- **MINOR** — feature/content script nuevo, refactor grande.
- **PATCH** — fix bloqueante o ajuste pequeño.

**Las versiones son por app, no por módulo.** Cada `vX.Y.Z` solo existe **una vez** en todo el roadmap del app, dentro de la carpeta del módulo principal de esa versión.

> **Nota Manifest v3:** la versión del `manifest.json` debe sincronizarse con el `package.json` al cerrar. Chrome Web Store rechaza versiones que no avancen monotónicamente.

---

## Estados posibles

| Emoji | Estado       | Significado                                                        |
| ----- | ------------ | ------------------------------------------------------------------ |
| ✅    | Completado   | Módulo o versión cerrada, en main, taggeada en git                 |
| 🚧    | En progreso  | Trabajo activo. **Solo una versión `🚧` a la vez en todo el app.** |
| 🔬    | En discusión | TDD del módulo en revisión, sin abrir versión todavía              |
| 📅    | Planeado     | Existe el archivo pero el trabajo no ha empezado                   |
| ⏸️    | Pausado      | Empezó pero se detuvo (rara vez se usa, requiere nota)             |

---

## Cómo planear una versión nueva

1. **Identifica el módulo principal** de la versión. Si no existe, créalo (`apps/kiro/roadmap/NN-nombre/README.md` con el TDD).
2. **Decide el número de versión** consultando la tabla cronológica de abajo. El siguiente número libre.
3. **Crea el archivo** `apps/kiro/roadmap/NN-nombre/vX.Y.Z.md` usando la plantilla.
4. **NO bumpees `apps/kiro/package.json` ni `manifest.json` todavía.** Eso pasa al cerrar la versión (ambos a la vez).
5. **Marca como `🚧 En progreso`** y agrega entrada al índice + a la tabla del TDD del módulo.
6. **Cierra primero la versión que estaba `🚧`** antes de empezar otra.

### Plantilla de versión (`vX.Y.Z.md`)

```markdown
# vX.Y.Z — [Título corto descriptivo]

**Estado**: 🚧 En progreso
**Inicio**: YYYY-MM-DD
**Cierre estimado**: YYYY-MM-DD
**Módulo**: NN-nombre
**TDD ref**: [README.md](README.md)

## Alcance

### Sí entra

- Subset concreto de las tareas del TDD del módulo que esta versión va a cerrar.

### NO entra (fuera de alcance)

- Tareas del TDD que se difieren a versiones posteriores.

## Permisos Chrome nuevos

> **Sección obligatoria.** Si no aplica, escribir "Ninguno". Lista permisos que se agregan al `manifest.json` (`storage`, `tabs`, `host_permissions`, etc.).

- [ ] `<permission>` — para qué se usa.

## Content scripts / service worker handlers nuevos

> **Sección obligatoria.** Si no aplica, escribir "Ninguno".

- [ ] `<archivo>` — match URL pattern, qué hace.

## Endpoints de mapi consumidos

> **Sección obligatoria.** Si no aplica, escribir "Ninguno".

- [ ] `<METHOD> /v1/<path>` o `ws:<event>` — desde dónde, propósito.

## TODOs

- [ ] Tarea 1 (la más pequeña que tiene sentido revisar sola)
- [ ] Tarea 2
- [ ] Bumpear `apps/kiro/package.json` Y `apps/kiro/manifest.json` a vX.Y.Z (deben ser idénticos)
- [ ] Commit + push + tag `kiro-vX.Y.Z`

## Decisiones tomadas durante esta versión

- **D-kiro-NNN** — [Título de la decisión]
  - Diverge del TDD: sí/no
  - Razón:
  - Consecuencia:

## Fixes durante desarrollo

- [ ] Fix cosmético encontrado mientras se trabajaba.

## Notas operativas

- Algo que recordar pero sin tarea concreta.
```

---

## Cómo manejar fixes

Misma regla que mapi/bvcpas: **¿bloquea?** → patch. **¿Puede esperar?** → sección `## Fixes` del archivo activo. **¿Lo descubrí mientras hacía el feature?** → trabajo del feature.

---

## Decisiones que divergen del TDD

Numeradas globales **por app**: `D-kiro-001`, `D-kiro-002`, etc.

**Qué es decisión y qué no:**

- ✅ Sí: "usamos Vite en lugar de webpack que sugiere el TDD" → D-kiro-XXX
- ✅ Sí: "no implementamos popup UI hasta v0.X" → D-kiro-XXX
- ❌ No: "elegimos `@types/chrome 0.0.270` última estable" → no decision, normal

---

## Cómo cerrar una versión

1. Marca el archivo como `✅ Completado`. "Cierre estimado" → "Cerrado: YYYY-MM-DD".
2. Bumpea **AMBOS**: `apps/kiro/package.json` Y `apps/kiro/manifest.json` `version` al número. Deben ser idénticos.
3. Actualiza la tabla cronológica de versiones de este README con `✅`.
4. Si hubo decisiones nuevas, agrégalas a la tabla de decisiones.
5. Si la versión cerró el módulo entero, marca el módulo como `✅` en su `README.md` y en el índice de módulos de este README.
6. Commit con mensaje `release(kiro): vX.Y.Z — [título]`.
7. Push a `main`.
8. Tag git: `git tag kiro-vX.Y.Z && git push --tags`.
9. (Opcional, según política Chrome Web Store): generar `dist.zip` y subir si aplica.

---

## Reglas duras

1. **Solo una versión `🚧` a la vez en todo el app.**
2. **No bumpees `package.json` ni `manifest.json` hasta cerrar.**
3. **`package.json.version` y `manifest.json.version` deben coincidir** al cierre.
4. **No mezcles features y fixes mayores en la misma versión.**
5. **El TDD manda salvo decisión documentada.**
6. **Permisos Chrome, content scripts y endpoints consumidos son secciones obligatorias** del archivo de versión.
7. **Tags git con prefijo `kiro-`.**
8. **Cada commit toca un solo app y solo cosas relacionadas con la versión activa.**

---

## Índice de módulos

| Carpeta                        | Status | Mx  | TDD                                                   | Versiones                         |
| ------------------------------ | ------ | --- | ----------------------------------------------------- | --------------------------------- |
| 00-foundation                  | ✅     | P0  | [README.md](00-foundation/README.md)                  | [v0.1.0](00-foundation/v0.1.0.md) |
| 10-bridge-client               | 📅     | P2  | [README.md](10-bridge-client/README.md)               | —                                 |
| 20-qbo-scripts/m2-uncats-write | 📅     | M2  | [README.md](20-qbo-scripts/m2-uncats-write/README.md) | —                                 |

---

## Versiones (orden cronológico)

| Versión | Módulo        | Estado | Tema                                        | Tag         | Archivo                                            |
| ------- | ------------- | ------ | ------------------------------------------- | ----------- | -------------------------------------------------- |
| 0.1.0   | 00-foundation | ✅     | Scaffold Vite + Manifest v3 (popup "Hello") | kiro-v0.1.0 | [00-foundation/v0.1.0.md](00-foundation/v0.1.0.md) |

---

## Decisiones acumuladas (`D-kiro-NNN`)

| ID         | Decisión                                                                                  | Versión | Diverge TDD |
| ---------- | ----------------------------------------------------------------------------------------- | ------- | ----------- |
| D-kiro-001 | Vite 5 (no 7) por compatibilidad con `vite-plugin-static-copy` ESM-only                   | 0.1.0   | No          |
| D-kiro-002 | `popup.html` en raíz de `apps/kiro/` (no en `src/popup/`) para que vite emita ruta limpia | 0.1.0   | No          |
| D-kiro-003 | `package.json type: "module"` para que vite cargue config + plugins ESM                   | 0.1.0   | No          |
| D-kiro-004 | Sin permisos especiales en v0.1.0 (`host_permissions`, `storage`, `tabs` entran después)  | 0.1.0   | No          |

---

## Onboarding rápido para sesión nueva

```
Trabajo en d:/proyectos/bvcpas-project/apps/kiro/. Lee en orden:
  1. apps/kiro/roadmap/README.md                    — proceso, índice, decisiones
  2. apps/kiro/roadmap/<NN-modulo>/README.md        — TDD del módulo activo
  3. apps/kiro/roadmap/<NN-modulo>/vX.Y.Z.md        — versión 🚧 (si hay)
  4. README.md raíz                                  — cómo correr el proyecto
  5. apps/kiro/roadmap/BACKLOG.md                   — items diferidos por trigger

Mi siguiente tarea es: [describe qué quieres hacer].
```
