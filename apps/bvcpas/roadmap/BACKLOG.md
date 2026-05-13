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

---

## Uncat. Transactions (módulo `12-customer-support`)

### Cuando exista plantilla de correo + integración Microsoft Graph

- **Envío real del follow-up email.** Hoy el botón Send del
  `<DraftFollowupDialog>` solo hace PATCH a `followups`
  (`status='sent'` + `sentAt`) — Send simulado, no manda correo. Para
  hacerlo real se necesita:
  - Plantilla configurable del correo (asunto + cuerpo).
  - Endpoint en mapi tipo
    `POST /v1/clients/:id/followups/:period/send` que arme + envíe +
    mueva el status en una sola transacción.
  - Integración con Microsoft Graph (o el provider que se decida).
  - El frontend reemplaza el `updateFollowup` por el endpoint nuevo;
    el dialog no cambia visualmente.
  - Trigger: mapi expone el endpoint de envío + plantilla decidida.

### Cuando el operador pida editar el cuerpo del correo antes de enviar

- **UI editable en `<DraftFollowupDialog>`.** Hoy es read-only — solo
  muestra labels To / CC / Follow-ups send / Public link. Cuando se
  necesite modificar el cuerpo antes del envío, agregar `<Textarea>`
  con la plantilla pre-llenada (placeholders del cliente sustituidos)
  + opción de editar.
  - Trigger: queja real del operador o decisión explícita post envío
    real funcional.

### Cuando se necesite que `sent → awaiting_reply` se dispare solo

- **Transición automática del followup.** Hoy el frontend mueve
  `pending|ready_to_send|partial_reply|complete|sent` con
  `computeNextFollowupStatus` (ver
  `fix-followup-status-transitions.md`). Falta `awaiting_reply` — el
  estado que sigue al `sent` cuando ya pasó tiempo sin respuesta del
  cliente.
  - Probable owner: **mapi**, no frontend. Mapi puede correr un job
    que detecte cuando un `sent` lleva N días sin reply y mueva
    automáticamente a `awaiting_reply`. O detectar reply real del
    cliente (vía bandeja de entrada).
  - Trigger: mapi expone el mecanismo (job o webhook).

### Cuando "Draft email on sync" deba generar Outlook draft real

- **Sync genera draft en Outlook.** Setting del `<CsConfigSheet>`
  (switch `draftEmailEnabled`) ya existe y se persiste, pero hoy no
  hace nada al sincronizar. Cuando se conecte el envío real, este
  switch debe controlar si al sync se genera además un draft de
  Outlook con la plantilla pre-llenada para revisión humana.
  - Trigger: envío real funcional + integración Outlook viva.

### Quick Links del `<CsQuickLinks>` (5 placeholders)

Hoy hacen toast "Coming soon". Cada uno se activa cuando se decida
qué hace exactamente y exista el endpoint/integración correspondiente:

- **Sheet** — probable: abrir el Google Sheet del cliente con resumen
  del período. Trigger: alguien define qué sheet, dónde vive, y
  cómo se enlaza por cliente.
- **@ Email thread** — atajo al hilo de correos con el cliente
  (Outlook Web vía Microsoft Graph). Trigger: integración Outlook
  viva + queries de hilo por contacto.
- **Call log** — bitácora de llamadas con el cliente. Trigger: mapi
  expone tabla/endpoint de call logs.
- **Add note** — nota interna del operador sobre el cliente (no
  sobre una transacción). Trigger: mapi expone tabla/endpoint de
  notas internas a nivel cliente.
- **Snooze** — posponer revisión del cliente N días. Trigger: mapi
  expone mecanismo de snooze (campo en `clients` o tabla aparte) +
  decisión sobre qué hacer cuando vence (¿highlight? ¿notificación?).

### Cuando exista pantalla pública del cliente

- **`/p/[token]`** — pantalla pública para que el cliente final
  clasifique sus uncats sin login. **No es parte del módulo
  `12-customer-support`** — vive aparte. El módulo solo gestiona el
  link público (Generate / Revoke / Regenerate, ver v0.5.9). Cuando
  se construya esa pantalla, conecta con el `public_link.url` que ya
  generamos.
  - Trigger: decisión de empezar el módulo `XX-public-uncats` (o
    como se llame).
