# 00-foundation — Scaffold base del frontend

**App:** bvcpas
**Status:** ✅ Completo
**Versiones que lo construyen:** [v0.1.0](v0.1.0.md)
**Última revisión:** 2026-05-04

---

## Por qué existe este módulo

Cualquier feature del frontend (login, AppShell, dashboards) asume un
piso común: Tailwind v4 configurado, shadcn/ui inicializado, path alias
`@/*`, layout root con fonts, scaffold de `src/modules/`,
`src/components/`, `src/lib/`. Sin ese piso, cada versión nueva tendría
que reescribir cómo se carga `cn()`, dónde van los primitivos shadcn,
cómo se imprime un global style, etc.

Este bloque se ocupa de poner ese piso UNA vez y nada más. No tiene
features de producto.

A diferencia de mapi `00-foundation` (bootstrap NestJS, DB, health,
metrics), aquí lo equivalente es:

- Configuración visual (Tailwind v4 + shadcn).
- Path alias y estructura de carpetas.
- Layout root con `<Toaster />` y fonts globales.
- Scaffold de `src/modules/`, `src/components/`, `src/lib/` con sus
  READMEs.

---

## Alcance

### Sí entra

- `CONVENTIONS.md` con todas las reglas del frontend.
- Tailwind v4 + shadcn/ui base (sin componentes individuales, esos
  llegan con cada módulo).
- Path alias `@/*` → `./src/*`.
- `src/lib/utils.ts` con `cn()` (de shadcn).
- Scaffold de carpetas con READMEs.
- `roadmap/README.md` + tabla de decisiones D-bvcpas-NNN.

### NO entra

- Cliente HTTP (`@/lib/http.ts`) → entra en `10-core-auth` cuando se
  necesita por primera vez.
- Componentes shadcn individuales (button, input, etc.) → entran cuando
  un módulo los pida (también en `10-core-auth` para el login).
- AppShell, sidebar, topbar → módulo `15-app-shell`.

---

## Naming visible al operador

No aplica directamente — este módulo no tiene tablas ni endpoints. Las
reglas de naming del frontend (kebab-case en archivos, PascalCase en
componentes, etc.) viven en
[CONVENTIONS.md §2](../CONVENTIONS.md#2-módulos-srcmodulesnn-name).

---

## Versiones

- **v0.1.0** (✅ cerrada): scaffold inicial. Ver
  [v0.1.0.md](v0.1.0.md).

Sin versiones planeadas a futuro — el bloque se considera estable. Si
algún cimiento cambia (ej. Tailwind v5 cuando salga, migración a otro
sistema de path alias), se abre versión nueva aquí.

---

## Notas

- `CONVENTIONS.md` se actualiza cada vez que cambia una regla
  estructural; los cambios se ligan a la versión donde se aplicaron
  (no se versionan por separado).
- La adopción del patrón "carpeta por bloque + `README.md` (TDD vivo)
  - `vX.Y.Z.md` (versión)" es heredada de mapi y se incorporó al
    arrancar v0.2.0. v0.1.0 se reorganizó a esta estructura
    retroactivamente.
