# bvcpas — roadmap

Una versión a la vez. Un TDD por versión. Un commit ≈ un TDD.

## Convenciones

- Archivo por versión: `v0.X.Y-nombre-corto.md`.
- Estado en el título del archivo: 🚧 (en progreso), ✅ (terminada),
  ❄️ (congelada / cancelada).
- Solo **una** versión 🚧 a la vez en todo el repo bvcpas.
- Cuando una versión termina, se cambia a ✅ y se referencia desde aquí.
- Items diferidos (cosas que aparecen pero no caben en la versión actual)
  se mueven a `roadmap/BACKLOG.md` agrupados por trigger concreto.

## Versión activa

| Versión | Título                        | Estado |
| ------- | ----------------------------- | ------ |
| 0.1.0   | Estructura, conventions, tema | 🚧     |

## Próximas versiones (tentativo)

| Versión | Título                                        |
| ------- | --------------------------------------------- |
| 0.2.0   | Login (10-auth) — formulario + sesión cliente |
| 0.3.0   | AppShell autenticado + dashboard home shell   |
| 0.4.0   | 11-clients lista (consume backend mapi)       |
| 0.5.0   | 12-customer-support tab del dashboard         |
| 0.6.0   | 13-dashboards detalle por cliente             |

Estos títulos son orientativos — cada uno se concreta en su TDD cuando
toque arrancarlo.

## Cómo arrancar una versión nueva

1. Crear `roadmap/v0.X.Y-titulo.md` con la plantilla descrita en
   [CONVENTIONS.md §7](../CONVENTIONS.md#7-roadmap-y-versiones).
2. Marcar la anterior como ✅ y actualizar la tabla "Versión activa" arriba.
3. Subir `version` en `package.json`.
4. Validar el TDD con Alfredo antes de codear.
