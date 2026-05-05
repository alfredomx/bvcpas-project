# Backlog — bvcpas

Items diferidos. Cada uno tiene un **trigger concreto** que lo regresa
del backlog a una versión activa. Si no hay trigger, no debería estar
aquí — debería estar descartado.

---

## Items por trigger

### Cuando alguien se queje de tener que re-navegar después de re-loguearse

- **Recordar última URL antes de redirect a login.** Que `(authenticated)/`
  guarde la URL que el usuario intentaba ver y la restaure post-login.
  Trigger: queja real, no especulación.

### Cuando mapi exponga password reset

- **"Forgot password" funcional.** Hoy es link visible que muestra toast
  "Contact your firm admin". Cuando mapi tenga endpoint de reset por
  email, este link conecta.

### Cuando exista pantalla de Settings de usuario

- **Cambio de password self-service** (`PATCH /v1/auth/me/password`).
  Trigger: pantalla de Settings entra al roadmap.

### Si Alfredo cambia de opinión sobre persistencia

- **Recordar sesión más allá de la pestaña** (localStorage opcional con
  toggle). Hoy se descarta explícitamente — sessionStorage por
  seguridad. Trigger: queja real.

### Cuando una pantalla tenga ≥3 fuentes de datos remotos

- **React Query / SWR** para fetching, cache, revalidación. Hoy no
  aplica porque cada pantalla consume 1–2 endpoints. Trigger: dashboard
  que necesita orquestar sync entre múltiples endpoints en tiempo real.

### Cuando una regresión cueste tiempo real de fix

- **Tests automatizados** (Vitest + Playwright). Hoy validación es
  manual. Trigger: bug regresivo en producción que un test hubiera
  atrapado.

### Cuando `lucide-react` falle al instalar primer ícono

- **Alinear versión de `lucide-react`.** v0.1.0 dejó la dep pinneada en
  `^1.14.0` (probablemente incorrecta — la línea estable es `^0.4xx.x`).
  Trigger: primer `npx shadcn@latest add` que requiera ícono falle, o
  primer `import { ... } from 'lucide-react'` no resuelva.
