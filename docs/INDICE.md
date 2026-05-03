# Índice de módulos

> Estado vivo de Etapa 1. Quien lea esto sabe qué hay, qué se está haciendo y qué sigue.
> Para detalle de cada módulo, abrir `modulos/MN-nombre.md` cuando exista.
> Para contexto general del proyecto, ver `_CONTEXTO_TEMPORAL.md`.

---

## Módulo activo

**P0 Fundación** — 🚧 en progreso. Sub-etapa actual: **P0.1 — Repo raíz**.

---

## Pre-requisitos técnicos

| ID  | Status | Nombre                         | Resuelve                                                                        | TDD                                        |
| --- | ------ | ------------------------------ | ------------------------------------------------------------------------------- | ------------------------------------------ |
| P0  | 🚧     | Fundación                      | Base técnica para los 3 apps (mapi, web, kiro) compilando + listos para módulos | [P0-fundacion.md](modulos/P0-fundacion.md) |
| P1  | 📅     | Intuit Core                    | Clientes QBO + tokens + refresh + migración 77 clientes                         | —                                          |
| P2  | 📅     | Plugin v2 base + Consola Debug | Plugin Manifest v3 + extension page para debug QBO                              | —                                          |

---

## Módulos Etapa 1 (reemplazo de los 7 GS)

| ID  | Status | Nombre                             | Reemplaza GS               | TDD |
| --- | ------ | ---------------------------------- | -------------------------- | --- |
| M1  | 📅     | Dashboard Administrator            | GS Dashboard Administrator | —   |
| M2  | 📅     | Uncats Pipeline                    | GS Uncat (por cliente)     | —   |
| M3  | 📅     | Customer Support Dashboard         | GS Customer Support        | —   |
| M4  | 📅     | Stmts/Recon Dashboard              | GS Stmts/Recon             | —   |
| M5  | 📅     | Receipts Dropbox                   | (mejora flujo de recibos)  | —   |
| M6  | 📅     | 1099 Dashboard                     | GS 1099's                  | —   |
| M7  | 📅     | W9 Dashboard con filtros guardados | GS W9 cliente              | —   |

---

## Próximo paso

P0.1 (Repo raíz) en progreso. Después:

- **P0.2** — `docker-compose.local.yml` con Postgres + Redis.
- **P0.3** — `apps/mapi/` scaffold NestJS.

**Repo Git:** `git@github.com:alfredomx/bvcpas-project.git`

---

## Estados

| Emoji | Significado                                                       |
| ----- | ----------------------------------------------------------------- |
| 📅    | Pendiente. No se ha empezado.                                     |
| 🔬    | TDD en discusión (operador y Claude planeando alcance).           |
| 🚧    | Codeando. TDD aprobado, sub-etapas en progreso.                   |
| ✅    | Cerrado. Commit-eado, smoke test pasa, operador lo usa día a día. |

**Solo un módulo puede estar `🚧 activo` a la vez** (regla heredada de mapi v0.x). Excepción: pre-requisito en paralelo con un módulo si no se pisan.

---

## Cómo se actualiza este archivo

- Operador o Claude lo actualizan cuando un módulo cambia de estado.
- Cuando un módulo arranca: `📅` → `🔬` (mientras se escribe el TDD) → `🚧` (cuando se codea) → `✅` (cuando cierra).
- Cuando un módulo cierra: agregar link al TDD en la columna correspondiente.
- Si el operador reordena prioridades, se anota en sección "Próximo paso".
