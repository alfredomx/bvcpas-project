# Roadmap — `kiro` (Chrome extension Manifest v3)

Esta carpeta contiene el plan y estado de cada versión del plugin `kiro` dentro de `bvcpas-project`. Un archivo por versión, todos siguen el mismo formato. Es la **fuente de verdad** para saber qué se hizo, qué se está haciendo y qué falta en este app.

> **Si eres un modelo (Claude u otro) iniciando sesión nueva sobre el plugin**: lee este README + el archivo con estado `🚧` (si hay) + `README.md` raíz del repo + el TDD del módulo correspondiente en `docs/modulos/`.

> **Items diferidos del TDD del plugin**: ver [`BACKLOG.md`](BACKLOG.md).

> **Roadmap de los otros apps**: cada app de `bvcpas-project` versiona independiente.
>
> - Backend: [`../../mapi/roadmap/`](../../mapi/roadmap/README.md)
> - Frontend: [`../../bvcpas/roadmap/`](../../bvcpas/roadmap/README.md)

---

## Estado actual

**Versión activa:** ninguna (v0.1.0 cerrada el 2026-05-03 con scaffold mínimo).
**Siguiente:** sin definir. El plugin es ejecutor (corre en QBO), depende de mapi para tener WebSocket gateway o endpoints HTTP del bridge listos.

## Próximas versiones (orden tentativo)

> Notas pre-decididas. El plugin lo dispara la necesidad concreta de leer/escribir en QBO desde el navegador del operador.

### v0.2.0 (?) — WebSocket client + auth con mapi

Cuando mapi tenga WebSocket gateway (`/v1/bridge`) y endpoints `qbo-internal/*` listos: client del plugin que se autentica con BridgeSecretGuard o JWT (decisión pendiente, ver memoria), establece WS y queda listo para recibir comandos.

### v0.3.0+ — Sync workflows en QBO

Content scripts que detectan páginas QBO, ejecutan queries internas (`getTransactions`, `getOfxPostedTransactions`, etc.), envían batches a mapi vía POST `/v1/qbo-internal/sync-batch`. Probablemente 2-3 versiones por workflow distinto.

El orden depende 100% de qué módulo Mx el operador prioriza y de qué endpoints del bridge entren en mapi primero.

---

## Cómo leer esta carpeta

```
apps/kiro/roadmap/
├── README.md      ← este archivo (índice + reglas del proceso)
├── BACKLOG.md     ← items diferidos del TDD, agrupados por trigger
├── v0.1.0.md      ← cada versión es un archivo independiente
└── v0.X.Y.md      ← solo uno puede tener estado "🚧 En progreso" a la vez
```

Las versiones siguen [SemVer](https://semver.org/lang/es/):

- `MAJOR.MINOR.PATCH` — `0.2.0`, `1.2.5`, etc.
- **MAJOR** — cambios incompatibles. No hay v1.0.0 todavía.
- **MINOR** — feature nueva, content script nuevo, refactor grande.
- **PATCH** — fix bloqueante o ajuste pequeño.

> **Nota Manifest v3:** la versión del `manifest.json` debe sincronizarse con el `package.json` al cerrar. Chrome Web Store rechaza versiones que no avancen monotónicamente.

---

## Estados posibles

| Emoji | Estado      | Significado                                                   |
| ----- | ----------- | ------------------------------------------------------------- |
| ✅    | Completado  | Versión cerrada, en main, taggeada en git                     |
| 🚧    | En progreso | Trabajo activo, **solo una versión a la vez** puede estar así |
| 📅    | Planeado    | Existe el archivo pero el trabajo no ha empezado              |
| ⏸️    | Pausado     | Empezó pero se detuvo (rara vez se usa, requiere nota)        |

---

## Cómo planear una nueva versión

1. **Decide el número:** ¿es feature/script nuevo (MINOR) o fix (PATCH)?
2. **Crea el archivo** `apps/kiro/roadmap/vX.Y.Z.md` usando la plantilla de abajo.
3. **NO bumpees `apps/kiro/package.json` ni `manifest.json` todavía.** Eso pasa al cerrar.
4. **Marca como `🚧 En progreso`** y agrega entrada al índice de este README.
5. **Cierra primero la versión que estaba `🚧`** antes de empezar otra.

### Plantilla de versión

```markdown
# vX.Y.Z — [Título corto descriptivo]

**Estado**: 🚧 En progreso
**Inicio**: YYYY-MM-DD
**Cierre estimado**: YYYY-MM-DD
**TDD ref**: [link al doc del TDD si aplica]

## Alcance

### Sí entra

- Feature/content script concreto que esta versión va a entregar.

### NO entra (fuera de alcance)

- Cosas relacionadas que se difieren a versiones futuras (con cuál).

## Permisos Chrome nuevos

> **Sección obligatoria.** Si no aplica, escribir "Ninguno". Lista permisos que se agregan al `manifest.json` (`storage`, `tabs`, `host_permissions`, etc.).

- [ ] `<permission>` — para qué se usa.

## Content scripts / service worker handlers nuevos

> **Sección obligatoria.** Si no aplica, escribir "Ninguno".

- [ ] `<archivo>` — match URL pattern, qué hace.

## Endpoints de mapi consumidos

> **Sección obligatoria.** Si no aplica, escribir "Ninguno". Lista endpoints del backend o mensajes WebSocket.

- [ ] `<METHOD> /v1/<path>` o `ws:<event>` — desde dónde, propósito.

## TODOs

- [ ] Tarea 1 (granularidad: lo más pequeño que tiene sentido revisar solo)
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

- Algo que hay que recordar pero no tiene fecha ni dueño.
```

---

## Cómo manejar fixes

Misma regla que mapi/bvcpas: **¿bloquea?** → patch. **¿Puede esperar?** → sección `## Fixes` del archivo activo. **¿Lo descubrí mientras hacía el feature?** → es trabajo del feature.

---

## Cómo manejar decisiones que divergen del TDD

Numeradas globales **por app**: `D-kiro-001`, `D-kiro-002`, etc.

**Qué es decisión y qué no:**

- ✅ Sí: "usamos Vite en lugar de webpack que sugiere el TDD" → D-kiro-XXX
- ✅ Sí: "no implementamos popup UI hasta v0.X" → D-kiro-XXX
- ❌ No: "elegimos `@types/chrome 0.0.270` última estable" → no decision, normal

---

## Cómo cerrar una versión

1. Marca el archivo como `✅ Completado`. "Cierre estimado" → "Cerrado: YYYY-MM-DD".
2. Bumpea **AMBOS**: `apps/kiro/package.json` Y `apps/kiro/manifest.json` `version` al número. Deben ser idénticos.
3. Actualiza la tabla de versiones de este README con `✅`.
4. Si hubo decisiones nuevas, agrégalas a la tabla de decisiones.
5. Commit con mensaje `release(kiro): vX.Y.Z — [título]`.
6. Push a `main`.
7. Tag git: `git tag kiro-vX.Y.Z && git push --tags`.
8. (Opcional, según política Chrome Web Store): generar `dist.zip` y subir si aplica.

---

## Reglas duras

1. **Solo una versión `🚧` a la vez en este app.**
2. **No bumpees `package.json` ni `manifest.json` hasta cerrar.**
3. **`package.json.version` y `manifest.json.version` deben coincidir** al cierre.
4. **No mezcles features y fixes mayores.**
5. **El TDD manda salvo decisión documentada.**
6. **Permisos Chrome, content scripts y endpoints consumidos son secciones obligatorias.**
7. **Tags git con prefijo `kiro-`.**

---

## Versiones

| Versión | Estado | Tema                                        | Archivo                |
| ------- | ------ | ------------------------------------------- | ---------------------- |
| 0.1.0   | ✅     | Scaffold Vite + Manifest v3 (popup "Hello") | [v0.1.0.md](v0.1.0.md) |

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
  1. apps/kiro/roadmap/README.md           — proceso y estado
  2. apps/kiro/roadmap/vX.Y.Z.md           — archivo con estado 🚧 (si hay)
  3. README.md raíz                         — cómo correr el proyecto
  4. docs/INDICE.md                         — estado de módulos
  5. docs/modulos/MX-nombre/README.md       — TDD del módulo en curso

Mi siguiente tarea es: [describe qué quieres hacer].
```
