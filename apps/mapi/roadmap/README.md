# Roadmap — `mapi` (backend NestJS)

Esta carpeta contiene el plan y estado de cada versión del backend `mapi` dentro de `bvcpas-project`. Un archivo por versión, todos siguen el mismo formato. Es la **fuente de verdad** para saber qué se hizo, qué se está haciendo y qué falta en este app.

> **Si eres un modelo (Claude u otro) iniciando sesión nueva sobre el backend**: lee este README + el archivo con estado `🚧` (si hay) + `CHANGELOG.md` raíz del repo + el TDD del módulo correspondiente en `docs/modulos/`.

> **Items diferidos del TDD del backend**: ver [`BACKLOG.md`](BACKLOG.md). Es la fuente única donde están las cosas que `mapi` ha pospuesto, agrupadas por trigger de retomar.

> **Roadmap de los otros apps**: cada app de `bvcpas-project` versiona independiente.
>
> - Frontend: [`../../bvcpas/roadmap/`](../../bvcpas/roadmap/README.md)
> - Plugin Chrome: [`../../kiro/roadmap/`](../../kiro/roadmap/README.md)

---

## Estado actual

**Versión activa:** ninguna (v0.1.0 cerrada el 2026-05-03 con deploy a `mapi.kodapp.com.mx`).
**Siguiente:** v0.2.0 — Intuit Core (clients + tokens encriptados + refresh + migración de los 77 clientes desde mapi v0.x prod).

## Próximas versiones (orden tentativo)

> Notas pre-decididas para no olvidar el contexto cuando lleguemos. NO son archivos `vX.Y.Z.md` completos (esos se crean al abrir la versión). Cuando algo cambie en la realidad, actualizar aquí.

### v0.2.0 — Intuit Core

Schema `clients` + `intuit_tokens` (AES-256-GCM) + endpoints OAuth (callback, refresh) + migración 77 clientes existentes desde mapi v0.x prod.

### v0.3.0+ — Sync engine

A partir de aquí depende del plugin `kiro` para datos QBO interno y del sync periódico Intuit Dev API. Orden tentativo: staging base → connector qbo-dev (BullMQ) → bridge plugin via HTTP/WS → mappers entidad por entidad.

El orden puede cambiar si llega un fix urgente, si un BACKLOG item se vuelve crítico, o si el usuario reprioriza.

---

## Cómo leer esta carpeta

```
apps/mapi/roadmap/
├── README.md      ← este archivo (índice + reglas del proceso)
├── BACKLOG.md     ← items diferidos del TDD, agrupados por trigger
├── v0.1.0.md      ← cada versión es un archivo independiente
├── v0.2.0.md
└── v0.X.Y.md      ← solo uno puede tener estado "🚧 En progreso" a la vez
```

Las versiones siguen [SemVer](https://semver.org/lang/es/):

- `MAJOR.MINOR.PATCH` — `0.2.0`, `1.2.5`, etc.
- **MAJOR** — cambios incompatibles. No hay v1.0.0 todavía.
- **MINOR** — feature nueva, módulo nuevo, refactor grande.
- **PATCH** — fix bloqueante o ajuste pequeño que no agrega features.

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

1. **Decide el número:** ¿es feature/módulo nuevo (MINOR) o fix (PATCH)?
2. **Crea el archivo** `apps/mapi/roadmap/vX.Y.Z.md` usando la plantilla de abajo.
3. **NO bumpees `apps/mapi/package.json` todavía.** Eso pasa al cerrar la versión.
4. **Marca como `🚧 En progreso`** y agrega entrada al índice de este README.
5. **Cierra primero la versión que estaba `🚧`** (commitea, taggea, marca ✅) antes de empezar otra. Solo una versión activa a la vez en este app.

### Plantilla de versión

```markdown
# vX.Y.Z — [Título corto descriptivo]

**Estado**: 🚧 En progreso
**Inicio**: YYYY-MM-DD
**Cierre estimado**: YYYY-MM-DD
**TDD ref**: [link al doc del TDD si aplica, p.ej. `docs/modulos/MX-nombre/README.md`]

## Alcance

### Sí entra

- Feature/módulo concreto que esta versión va a entregar.

### NO entra (fuera de alcance)

- Cosas relacionadas que se difieren a versiones futuras (con cuál).

## Eventos a agregar (event_log)

> **Sección obligatoria.** Si no aplica, escribir "Ninguno" — pero NO omitir.

- [ ] `<event.type>` — payload: `{ ... }`. Disparado en `<service>.<method>`.
      Razón: <por qué amerita registro permanente vs solo Loki>.

## Errores de dominio nuevos

> **Sección obligatoria.** Si no aplica, escribir "Ninguno". Recuerda mapearlos en `src/common/errors/domain-error.filter.ts` con HTTP status.

- [ ] `<NombreError>` (HTTP <status>): `<código_string>`. Origen.

## Endpoints API nuevos

> **Sección obligatoria.** Si no aplica, escribir "Ninguno". Aplicar reglas DOC-X (ApiTags, ApiOperation, ApiResponse con DTO Zod).

- [ ] `<METHOD> /v1/<path>` — qué hace. DTO request: <X>. DTO response: <Y>.

## TODOs

- [ ] Tarea 1 (granularidad: lo más pequeño que tiene sentido revisar solo)
- [ ] Tarea 2
- [ ] ...
- [ ] Bumpear `apps/mapi/package.json` a vX.Y.Z
- [ ] Commit + push + tag `mapi-vX.Y.Z`

## Decisiones tomadas durante esta versión

- **D-mapi-NNN** — [Título de la decisión]
  - Diverge del TDD: sí/no
  - Razón:
  - Consecuencia:

## Fixes durante desarrollo (no son hotfixes urgentes)

- [ ] Fix cosmético encontrado mientras se trabajaba en el feature.

## Notas operativas (recordatorios sin tarea concreta)

- Algo que hay que recordar pero no tiene fecha ni dueño.
```

---

## Cómo manejar fixes

Regla en una pregunta: **¿este bug bloquea a alguien (usuarios, deploy, yo)?**

| Respuesta                                | Tipo                                   | Dónde va                                                 |
| ---------------------------------------- | -------------------------------------- | -------------------------------------------------------- |
| Sí, bloquea ahora                        | **Hotfix urgente** → patch (`0.X.Y+1`) | Archivo nuevo `vX.Y+1.md`                                |
| No, puede esperar                        | **Fix menor**                          | Sección `## Fixes durante desarrollo` del archivo activo |
| Lo descubrí mientras escribía el feature | **Trabajo del feature**                | No se documenta como "fix", es parte de los TODOs        |

**Hotfix urgente — proceso completo:**

1. Si tienes una versión `🚧` activa, **pausa**: agrega nota en su archivo "pausado por hotfix vX.Y.Z".
2. Crea `vX.Y.Z+1.md` (patch). Solo un TODO o dos: el fix.
3. Aplica fix, prueba, commitea, push, tag.
4. Cierra el archivo del patch como `✅`.
5. Reanuda la versión que estaba `🚧`: quita la nota de pausa y sigue.

---

## Cómo manejar decisiones que divergen del TDD

Cada decisión que **no es trivial** y diverge del TDD se numera de forma global por app: `D-mapi-001`, `D-mapi-002`, ..., `D-mapi-NNN`. Se anota dentro del archivo de la versión donde se tomó (sección `## Decisiones tomadas durante esta versión`) y se agrega al índice global de decisiones de este README.

**Qué es decisión y qué no:**

- ✅ Sí: "usamos puerto 4100 en lugar de lo que dice el TDD" → D-mapi-XXX
- ✅ Sí: "no implementamos `--role` flag aunque el TDD lo menciona" → D-mapi-XXX
- ❌ No: "elegimos `bcrypt 6.0.0` porque es la última estable" → no decision, normal
- ❌ No: "renombramos un archivo" → trabajo del feature

Si dudas: si imaginas que en 6 meses alguien lee el código y se pregunta "¿por qué hicieron esto y no lo del TDD?" → es decisión, documéntala.

---

## Cómo cerrar una versión

Cuando todos los TODOs estén `[x]` y todo esté en main:

1. Marca el archivo como `✅ Completado`. Cambia "Cierre estimado" por "Cerrado: YYYY-MM-DD".
2. Bumpea `apps/mapi/package.json` `version` al número de la versión.
3. Actualiza la tabla de versiones de este README con `✅`.
4. Si hubo decisiones nuevas, agrégalas a la tabla de decisiones de este README.
5. Commit con mensaje `release(mapi): vX.Y.Z — [título]`.
6. Push a `main`.
7. Tag git: `git tag mapi-vX.Y.Z && git push --tags` (prefijo `mapi-` evita choque con tags de los otros apps).

---

## Reglas duras (no negociables)

1. **Solo una versión `🚧` a la vez en este app.** Excepción: hotfix urgente que pausa la activa.
2. **No bumpees `apps/mapi/package.json` hasta cerrar.** Mientras esté `🚧`, queda en la versión anterior.
3. **No mezcles features y fixes mayores en la misma versión.** Si descubres que el fix es grande, ábrelo aparte.
4. **El TDD manda salvo decisión documentada.** Si diverges sin documentarlo, en 3 meses nadie sabrá por qué.
5. **Eventos a agregar (event_log), errores de dominio nuevos y endpoints API nuevos son secciones obligatorias.** Si no aplican, escribir "Ninguno" — pero NO omitir.
6. **Tags git con prefijo `mapi-`** (p.ej. `mapi-v0.2.0`). Cada app tiene su propio namespace de tags.

---

## Versiones

| Versión | Estado | Tema                                                                                | Archivo                |
| ------- | ------ | ----------------------------------------------------------------------------------- | ---------------------- |
| 0.1.0   | ✅     | Bootstrap NestJS + core + DB/Health + Metrics/Scalar + deploy Coolify (mapi.kodapp) | [v0.1.0.md](v0.1.0.md) |

---

## Decisiones acumuladas (`D-mapi-NNN`)

Cada decisión se numera de forma global por app. Cuando se toma una nueva, se agrega aquí y en el archivo de la versión donde nació.

| ID         | Decisión                                                                                                | Versión | Diverge TDD |
| ---------- | ------------------------------------------------------------------------------------------------------- | ------- | ----------- |
| D-mapi-001 | `tsc + tsc-alias` directo, sin `nest build` (heredado de mapi v0.x D-071)                               | 0.1.0   | No          |
| D-mapi-002 | Prefijo `/v1` con exclude `metrics` (Prometheus convención mundial)                                     | 0.1.0   | No          |
| D-mapi-003 | `cleanupOpenApiDoc` de nestjs-zod (en lugar de `patchNestjsSwagger` que no existe en v5)                | 0.1.0   | No          |
| D-mapi-004 | Scalar `layout: 'modern'` + `hideModels: true` para evitar Models en sidebar                            | 0.1.0   | No          |
| D-mapi-005 | Schema env vars con `emptyToUndefined` preprocess (vars vacías en `.env` no rompen `.optional()`)       | 0.1.0   | No          |
| D-mapi-006 | DbModule `@Global()` con tokens `DB` (drizzle) y `DB_CLIENT` (postgres-js raw); shutdown timeout 5s     | 0.1.0   | No          |
| D-mapi-007 | Subdominio prod = `mapi.kodapp.com.mx` (legacy mapi v0.x sigue en `mapi.alfredo.mx` durante transición) | 0.1.0   | No          |

---

## Onboarding rápido para sesión nueva

```
Trabajo en d:/proyectos/bvcpas-project/apps/mapi/. Lee en orden:
  1. apps/mapi/roadmap/README.md           — proceso y estado
  2. apps/mapi/roadmap/vX.Y.Z.md           — archivo con estado 🚧 (si hay)
  3. README.md raíz                         — cómo correr el proyecto
  4. docs/INDICE.md                         — estado de módulos
  5. docs/modulos/MX-nombre/README.md       — TDD del módulo en curso

Mi siguiente tarea es: [describe qué quieres hacer].
```
