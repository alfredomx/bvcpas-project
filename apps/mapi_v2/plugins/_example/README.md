# \_example

## Qué hace

Plugin de **ejemplo / referencia**: la prueba viva de que el registro del core monta un plugin y le inyecta su propia config. No tiene dominio real. Se reemplaza cuando entre `plugins/intuit` (el primer plugin de verdad); sirve como plantilla mínima de cómo se ve un `ModuleDef`.

## Estado

`🚧 en construcción` (referencia temporal del paso 5 de la fundación).

## Entradas / Salidas

### Endpoints

| Método | Ruta                | Qué hace                                               | Auth |
| ------ | ------------------- | ------------------------------------------------------ | ---- |
| `GET`  | `/v1/_example/ping` | Devuelve `{ plugin, greeting }` (greeting = su config) | —    |

## Config (env vars)

| Var                | Default               | Caso                                                        |
| ------------------ | --------------------- | ----------------------------------------------------------- |
| `EXAMPLE_GREETING` | `hola desde _example` | Texto que devuelve `/ping` (con default → no rompe el boot) |

## Errores

Ninguno.

## Usa del core (coarse)

Solo el tipo `ModuleDef` del registro (`@/registry/module-def`). Nada más: ni db, ni queue, ni redis.

## NO hace (límites)

No toca DB, ni colas, ni nada de dominio. Es andamiaje de demostración; se borra cuando deje de ser útil.
