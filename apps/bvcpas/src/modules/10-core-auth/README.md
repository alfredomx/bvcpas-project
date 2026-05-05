# 10-core-auth (frontend)

Login + sesión + guard. Match 1:1 con
[`apps/mapi/src/modules/10-core-auth/`](../../../../mapi/src/modules/10-core-auth)
(backend). Aquí solo consumimos los endpoints que mapi expone.

## Qué expone

| Símbolo                                                     | Para qué                                                                                                                                       |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `useSession()` (`hooks/use-session.ts`)                     | Hook client-side con `{ user, accessToken, isLoading, login, logout }`. Hidrata desde sessionStorage al montar y valida con `GET /v1/auth/me`. |
| `<LoginForm />` (`components/login-form.tsx`)               | Form de `/`. (Pendiente — Bloque 5 v0.2.0.)                                                                                                    |
| `login`, `logout`, `me` (`api/auth.api.ts`)                 | Wrappers tipados sobre los endpoints `/v1/auth/*`.                                                                                             |
| `readToken`, `clearSession`, etc (`lib/session-storage.ts`) | Único punto que toca sessionStorage. Fuera de aquí, nadie.                                                                                     |
| Tipos `User`, `LoginResponse`, etc (`types.ts`)             | Shape del backend (camelCase, `accessToken` no `access_token`).                                                                                |

## Pantallas que lo consumen

- `/` → `<LoginForm />`.
- `(authenticated)/layout.tsx` → `useSession()` para guard de sesión y
  listener `auth:unauthorized`.

## Endpoints de mapi consumidos

- `POST /v1/auth/login` — submit del form.
- `GET /v1/auth/me` — validación al montar `(authenticated)/`.
- `POST /v1/auth/logout` — click en logout.

## Errores de mapi → mensaje en UI

| Code mapi (HTTP)            | Mensaje en UI                                        |
| --------------------------- | ---------------------------------------------------- |
| `INVALID_CREDENTIALS` (401) | "Invalid email or password."                         |
| `USER_DISABLED` (401)       | "Your account is disabled. Contact your firm admin." |
| `SESSION_REVOKED` (401)     | "Your session expired. Sign in again."               |
| `SESSION_EXPIRED` (401)     | "Your session expired. Sign in again."               |
| Otros / network             | "Could not sign in. Try again."                      |

UI no diferencia `SESSION_REVOKED` vs `SESSION_EXPIRED`.

## Detalles importantes

- **sessionStorage, no localStorage** (D-bvcpas-002 v0.2.0). Sesión muere
  al cerrar la pestaña. Sin checkbox "Keep me signed in".
- **Validación con `/me` al montar** (D-bvcpas-003). 1 round-trip extra
  pero detección inmediata de sesiones revocadas entre tabs.
- **401 dispara evento DOM `auth:unauthorized`** desde `lib/http.ts`.
  El `(authenticated)/layout.tsx` (único listener) lo usa para cerrar
  sesión global y redirect a `/`.
- **El hook NO muestra toasts.** El caller decide el mensaje (ver
  tabla de errores arriba).

## Versiones

- v0.2.0 (🚧) — implementación inicial. Ver
  [`roadmap/10-core-auth/v0.2.0.md`](../../../roadmap/10-core-auth/v0.2.0.md).
