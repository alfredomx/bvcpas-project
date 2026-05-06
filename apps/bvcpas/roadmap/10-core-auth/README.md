# 10-core-auth — Login + sesión + guard (frontend)

**App:** bvcpas
**Status:** ✅ Completo (primera versión cerrada; el módulo puede
reabrirse en el futuro para `change-password`).
**Versiones que lo construyen:** [v0.2.0](v0.2.0.md) (login + sesión +
guard inicial), [v0.2.1](v0.2.1.md) (tests retroactivos)
**Última revisión:** 2026-05-05
**Espejo backend:** [`apps/mapi/roadmap/10-core-auth/`](../../../mapi/roadmap/10-core-auth/README.md)

---

## Por qué existe este módulo

Toda pantalla autenticada de bvcpas necesita:

- Saber si el usuario actual tiene sesión válida.
- Adjuntar `Authorization: Bearer <jwt>` a cada request a mapi.
- Reaccionar a 401 (sesión revocada o expirada) cerrando sesión local
  y mandando al usuario de vuelta a `/login`.

Sin este módulo, ningún feature puede consumir mapi de forma
autenticada y la pantalla `/login` no haría nada útil.

Match 1:1 con `apps/mapi/roadmap/10-core-auth/`. Backend define los
endpoints (`/v1/auth/login`, `/v1/auth/me`, `/v1/auth/logout`),
frontend solo los consume.

---

## Alcance

### Sí entra (a lo largo de las versiones)

- `src/modules/10-core-auth/` autocontenido:
  - `api/auth.api.ts` — `login()`, `logout()`, `me()`.
  - `components/login-form.tsx` — formulario `/login`.
  - `hooks/use-session.ts` — hook con `{ user, accessToken, login,
logout, isLoading }`.
  - `lib/session-storage.ts` — wrapper sobre sessionStorage.
  - `types.ts` — `User`, `LoginRequest`, `LoginResponse`, `MeResponse`.
- `src/lib/http.ts` (cross-cutting, vive en `lib/` no en este módulo)
  pero lo introduce esta versión.
- Group route `(authenticated)/layout.tsx` con guard de sesión.

### NO entra

- Cambio de password self-service (`PATCH /v1/auth/me/password`) —
  versión futura cuando exista pantalla de Settings.
- Recovery por email — mapi no lo expone, sin trigger para implementar.
- 2FA / OAuth social / multi-tenant — mapi no los implementa; cuando
  los implemente, este módulo los consume.
- Refresh tokens — JWT de 7d es suficiente.
- AppShell visual (sidebar, topbar, avatar) — vive en `15-app-shell`,
  no aquí. Este módulo solo provee `useSession()` y el guard.

---

## Naming visible al operador

### sessionStorage keys

| Key                  | Tipo   | Notas                                                                                                         |
| -------------------- | ------ | ------------------------------------------------------------------------------------------------------------- |
| `bvcpas.accessToken` | string | JWT crudo. Se incluye en `Authorization`.                                                                     |
| `bvcpas.user`        | JSON   | `User` parseado para evitar pegarle al backend en cada render. Refresco real con `GET /v1/auth/me` al montar. |

Centralizado en `src/modules/10-core-auth/lib/session-storage.ts`.
Fuera de ahí, nadie toca `sessionStorage` directo.

### Eventos DOM

| Evento              | Quién lo dispara                                     | Quién escucha                                                              |
| ------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------- |
| `auth:unauthorized` | `lib/http.ts` ante 401 (excepto en `/v1/auth/login`) | `(authenticated)/layout.tsx` — limpia sesión + redirect a `/login` + toast |

---

## Endpoints API consumidos (de mapi)

| Endpoint               | Cuándo lo consume el frontend                            |
| ---------------------- | -------------------------------------------------------- |
| `POST /v1/auth/login`  | Submit del form `<LoginForm />`                          |
| `GET /v1/auth/me`      | Validación al montar `(authenticated)/layout.tsx`        |
| `POST /v1/auth/logout` | Click en logout (ubicación final TBD por `15-app-shell`) |

---

## Errores de mapi → mensajes en UI

| Code mapi (HTTP)            | Mensaje en UI                                        |
| --------------------------- | ---------------------------------------------------- |
| `INVALID_CREDENTIALS` (401) | "Invalid email or password."                         |
| `USER_DISABLED` (401)       | "Your account is disabled. Contact your firm admin." |
| `SESSION_REVOKED` (401)     | "Your session expired. Sign in again."               |
| `SESSION_EXPIRED` (401)     | "Your session expired. Sign in again."               |
| Otros / network failure     | "Could not sign in. Try again."                      |

UI no diferencia `SESSION_REVOKED` vs `SESSION_EXPIRED` — para el
usuario significan lo mismo.

---

## Flujos de runtime

Detalle paso a paso vive en cada `vX.Y.Z.md` que lo introduce. Resumen:

1. **Login exitoso** → escribe sessionStorage + redirect a `/dashboard`.
2. **Login fallido** → toast con mensaje mapeado, queda en `/login`.
3. **Refresh estando logueado** → `GET /v1/auth/me` valida; si OK
   renderiza, si 401 limpia y manda a `/login`.
4. **Logout manual** → llama `/v1/auth/logout`, ignora respuesta,
   limpia local + redirect a `/login`.
5. **401 en cualquier request autenticada** → dispatch
   `auth:unauthorized` → listener cierra sesión + redirect.

---

## Versiones

- **v0.2.0** (🚧 en progreso): login + sesión persistente en pestaña +
  guard básico + placeholder de `/dashboard`. Sin AppShell todavía.
- **vX.Y.Z futura** (no planeada hoy): change-password self-service
  cuando exista pantalla de Settings.

---

## Notas

- **JWT en sessionStorage, no localStorage** (D-bvcpas-002 en v0.2.0).
  Sesión muere al cerrar pestaña. Sin checkbox "Keep me signed in".
- **Validación con `me()` al montar** (D-bvcpas-003 en v0.2.0). Trade-off:
  1 round-trip extra al cargar pero detección inmediata si la sesión
  fue revocada por admin entre tabs.
- **Cliente HTTP propio (`src/lib/http.ts`)** introducido en v0.2.0
  como D-bvcpas-001 — fetch wrapper de ~50 líneas, sin deps. Si crece
  a interceptors complejos, se evalúa cambiar a `ofetch`/`ky`.
