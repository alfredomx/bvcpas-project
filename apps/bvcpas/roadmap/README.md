# Roadmap — `bvcpas` (frontend Next.js)

Esta carpeta contiene el plan y estado de cada versión del frontend `bvcpas` dentro de `bvcpas-project`. Un archivo por versión, todos siguen el mismo formato. Es la **fuente de verdad** para saber qué se hizo, qué se está haciendo y qué falta en este app.

> **Si eres un modelo (Claude u otro) iniciando sesión nueva sobre el frontend**: lee este README + el archivo con estado `🚧` (si hay) + `README.md` raíz del repo + el TDD del módulo correspondiente en `docs/modulos/`.

> **Items diferidos del TDD del frontend**: ver [`BACKLOG.md`](BACKLOG.md).

> **Roadmap de los otros apps**: cada app de `bvcpas-project` versiona independiente.
>
> - Backend: [`../../mapi/roadmap/`](../../mapi/roadmap/README.md)
> - Plugin Chrome: [`../../kiro/roadmap/`](../../kiro/roadmap/README.md)

---

## Estado actual

**Versión activa:** ninguna (v0.1.0 cerrada el 2026-05-03 con scaffold mínimo).
**Siguiente:** sin definir. Probables candidatos cuando llegue su trigger: stack visual (Tailwind + shadcn), página login + AuthClient contra mapi, primer dashboard operativo (probablemente M1 - Dashboard Administrator).

## Próximas versiones (orden tentativo)

> Notas pre-decididas. Al frontend lo dispara la necesidad de un módulo concreto, no se construye en abstracto.

### v0.2.0 (?) — Stack visual + auth client

Cuando el primer módulo de la Etapa 1 (M1-M7) requiera UI: Tailwind, shadcn/ui, AuthClient (login form contra mapi), Layout base con navegación.

### v0.3.0+ — Dashboards operativos

Un dashboard por módulo M1-M7. Probablemente 1-2 versiones por dashboard.

El orden depende 100% de qué módulo Mx el operador prioriza.

---

## Cómo leer esta carpeta

```
apps/bvcpas/roadmap/
├── README.md      ← este archivo (índice + reglas del proceso)
├── BACKLOG.md     ← items diferidos del TDD, agrupados por trigger
├── v0.1.0.md      ← cada versión es un archivo independiente
└── v0.X.Y.md      ← solo uno puede tener estado "🚧 En progreso" a la vez
```

Las versiones siguen [SemVer](https://semver.org/lang/es/):

- `MAJOR.MINOR.PATCH` — `0.2.0`, `1.2.5`, etc.
- **MAJOR** — cambios incompatibles. No hay v1.0.0 todavía.
- **MINOR** — feature nueva, página nueva, refactor grande.
- **PATCH** — fix bloqueante o ajuste pequeño.

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

1. **Decide el número:** ¿es feature/página nueva (MINOR) o fix (PATCH)?
2. **Crea el archivo** `apps/bvcpas/roadmap/vX.Y.Z.md` usando la plantilla de abajo.
3. **NO bumpees `apps/bvcpas/package.json` todavía.** Eso pasa al cerrar la versión.
4. **Marca como `🚧 En progreso`** y agrega entrada al índice de este README.
5. **Cierra primero la versión que estaba `🚧`** antes de empezar otra. Solo una versión activa a la vez en este app.

### Plantilla de versión

```markdown
# vX.Y.Z — [Título corto descriptivo]

**Estado**: 🚧 En progreso
**Inicio**: YYYY-MM-DD
**Cierre estimado**: YYYY-MM-DD
**TDD ref**: [link al doc del TDD si aplica]

## Alcance

### Sí entra

- Feature/página concreta que esta versión va a entregar.

### NO entra (fuera de alcance)

- Cosas relacionadas que se difieren a versiones futuras (con cuál).

## Páginas/rutas nuevas

> **Sección obligatoria.** Si no aplica, escribir "Ninguna".

- [ ] `/<ruta>` — qué muestra. Componentes principales.

## Endpoints de mapi consumidos

> **Sección obligatoria.** Si no aplica, escribir "Ninguno". Lista los endpoints del backend que esta versión llama.

- [ ] `<METHOD> /v1/<path>` — desde dónde, propósito.

## Errores de UX manejados

> **Sección obligatoria.** Si no aplica, escribir "Ninguno". Cómo se muestran al usuario fallos de red, 4xx/5xx, validación.

- [ ] `<escenario>` — UX result.

## TODOs

- [ ] Tarea 1 (granularidad: lo más pequeño que tiene sentido revisar solo)
- [ ] Tarea 2
- [ ] Bumpear `apps/bvcpas/package.json` a vX.Y.Z
- [ ] Commit + push + tag `bvcpas-vX.Y.Z`

## Decisiones tomadas durante esta versión

- **D-bvcpas-NNN** — [Título de la decisión]
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

Misma regla que en mapi: **¿bloquea?** → patch (vX.Y.Z+1). **¿Puede esperar?** → sección `## Fixes durante desarrollo` del archivo activo. **¿Lo descubrí mientras hacía el feature?** → es trabajo del feature, no fix.

---

## Cómo manejar decisiones que divergen del TDD

Numeradas globales **por app**: `D-bvcpas-001`, `D-bvcpas-002`, etc. Anotadas en el archivo de la versión donde nacieron + en la tabla de decisiones de este README.

**Qué es decisión y qué no:**

- ✅ Sí: "elegimos shadcn/ui en lugar de Material UI que sugiere el TDD" → D-bvcpas-XXX
- ✅ Sí: "no implementamos i18n aunque el TDD lo menciona" → D-bvcpas-XXX
- ❌ No: "elegimos `tailwindcss 4.0.0` porque es la última estable" → no decision, normal

---

## Cómo cerrar una versión

1. Marca el archivo como `✅ Completado`. Cambia "Cierre estimado" por "Cerrado: YYYY-MM-DD".
2. Bumpea `apps/bvcpas/package.json` `version` al número de la versión.
3. Actualiza la tabla de versiones de este README con `✅`.
4. Si hubo decisiones nuevas, agrégalas a la tabla de decisiones.
5. Commit con mensaje `release(bvcpas): vX.Y.Z — [título]`.
6. Push a `main`.
7. Tag git: `git tag bvcpas-vX.Y.Z && git push --tags` (prefijo `bvcpas-`).

---

## Reglas duras

1. **Solo una versión `🚧` a la vez en este app.**
2. **No bumpees `apps/bvcpas/package.json` hasta cerrar.**
3. **No mezcles features y fixes mayores.**
4. **El TDD manda salvo decisión documentada.**
5. **Páginas/rutas nuevas, endpoints consumidos y errores UX son secciones obligatorias.**
6. **Tags git con prefijo `bvcpas-`.**

---

## Versiones

| Versión | Estado | Tema                                                 | Archivo                |
| ------- | ------ | ---------------------------------------------------- | ---------------------- |
| 0.1.0   | ✅     | Scaffold Next.js 15 + React 19 mínimo (Hello bvcpas) | [v0.1.0.md](v0.1.0.md) |

---

## Decisiones acumuladas (`D-bvcpas-NNN`)

| ID           | Decisión                                                                                 | Versión | Diverge TDD                    |
| ------------ | ---------------------------------------------------------------------------------------- | ------- | ------------------------------ |
| D-bvcpas-001 | Sin Tailwind/shadcn en v0.1.0 (stack visual TBD hasta primer dashboard)                  | 0.1.0   | No                             |
| D-bvcpas-002 | App renombrado de `web` a `bvcpas` (carpeta y package name)                              | 0.1.0   | Sí (TDD original usaba `web/`) |
| D-bvcpas-003 | `next-env.d.ts` gitignored y prettier-ignored (autogenerado por Next, fricciona linters) | 0.1.0   | No                             |

---

## Onboarding rápido para sesión nueva

```
Trabajo en d:/proyectos/bvcpas-project/apps/bvcpas/. Lee en orden:
  1. apps/bvcpas/roadmap/README.md         — proceso y estado
  2. apps/bvcpas/roadmap/vX.Y.Z.md         — archivo con estado 🚧 (si hay)
  3. README.md raíz                         — cómo correr el proyecto
  4. docs/INDICE.md                         — estado de módulos
  5. docs/modulos/MX-nombre/README.md       — TDD del módulo en curso

Mi siguiente tarea es: [describe qué quieres hacer].
```
