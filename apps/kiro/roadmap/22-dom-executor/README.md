# 22-dom-executor — Intérprete genérico de operaciones DOM

**App:** kiro
**Status:** ✅ v0.4.0 cerrada (lado kiro, unit verde) — primitivas DOM genéricas. Verificación en vivo end-to-end pendiente de mapi v0.20.0.
**Backend asociado:** mapi `23-plugin-bridge` (manda las recetas) + el módulo que arme la receta de login (Fase 4).
**Última revisión:** 2026-06-14

## Por qué existe este bloque

Es el gemelo de `21-fetch-executor`, pero para **manipular el DOM** en vez de hacer fetch.
Permite que mapi llene formularios y haga clics en la pestaña del banco **sin que kiro
tenga lógica de banco**: kiro solo trae un set fijo de operaciones genéricas (`fill`,
`click`, `waitFor`, `getText`) y mapi manda una **receta** (lista de pasos como DATA) que
kiro ejecuta a ciegas.

**Design B (el moat):** los selectores, valores y orden los dicta SIEMPRE mapi. kiro no
sabe qué es Chase ni qué significa `#signin-button`. Cuando un banco cambie su HTML, se
edita la receta en **mapi** (deploy fácil), nunca la extensión.

**Por qué DATA y no código:** MV3 prohíbe `eval`/`new Function` en extensiones (CSP), así
que mapi NO puede mandar una función para que kiro la evalúe. La solución equivalente y
permitida: mapi manda los pasos como JSON y kiro los interpreta con ops fijas. Mismo
resultado (kiro tonto, mapi con toda la lógica), dentro de lo que MV3 permite.

## Contexto de ejecución

Igual que `execute_fetch`: las ops de DOM corren en el **content script** de la pestaña
objetivo (no en el SW — el SW no tiene DOM). mapi elige la pestaña por `tabId` (obtenido
de `list_tabs`) y manda `execute_dom` con ese `tabId` + los pasos. El dispatcher (SW)
rutea al content script vía `chrome.tabs.sendMessage(tabId, …)` y devuelve el resultado.

## Operaciones (v0.4.0)

| op        | params                          | qué hace                                                                                                                                     |
| --------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `fill`    | `selector`, `value`             | `focus` + native value setter + dispara `input`/`change`/`blur` (para que React/el form registren el valor; un `el.value=x` pelón no basta). |
| `click`   | `selector`                      | `el.click()`                                                                                                                                 |
| `waitFor` | `selector`, `timeoutMs?` (5000) | polling de `querySelector` hasta que aparezca o venza el timeout                                                                             |
| `getText` | `selector`                      | devuelve `el.textContent` (para que mapi lea estado: errores, "enter code", etc.)                                                            |

Una receta = `{ tabId, steps: [ {op,…}, … ] }`. Se ejecutan en orden; si un paso falla
(selector no encontrado / timeout) se detiene y devuelve `ok:false` + `failedStep` + `error`.

## Decisiones (D-kiro-NNN)

| ID         | Decisión                                                                                                                                                                                                                                                      |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D-kiro-B12 | Ops de DOM como DATA (receta JSON), NO código (`eval` prohibido en MV3). kiro = intérprete tonto de ops fijas; la receta vive en mapi.                                                                                                                        |
| D-kiro-B13 | `fill` usa el native value setter del prototipo + dispara `input`/`change`/`blur`; lo crítico son los eventos (no el delay). Validado en vivo con el logon de Chase (2026-06-14).                                                                             |
| D-kiro-B14 | `execute_dom` rutea por `tabId` explícito (mapi lo saca de `list_tabs`), no por origin de URL como `execute_fetch`.                                                                                                                                           |
| D-kiro-B15 | Set de ops mínimo y universal (`fill`/`click`/`waitFor`/`getText`). `navigate` se difiere: cambiar `location` recarga la página y mata el content script antes de responder → cuando entre, será op a nivel SW (`chrome.tabs.update`), no del content script. |

## NO entra (diferido)

- `navigate` (op a nivel SW) y flag de incógnito → versión siguiente si se necesita.
- Delays human-like entre pasos → opcional, lo decide la receta de mapi (no la primitiva).
- La receta de login de Chase en sí → Fase 4 (módulo de mapi), consume estas ops.

## Tests (Tipo A, Vitest + jsdom)

- `fill`: setea value y dispara `input`/`change`/`blur`; funciona sobre input controlado.
- `click`: invoca el click del elemento.
- `waitFor`: resuelve al aparecer el selector; error en timeout.
- `getText`: devuelve el texto del elemento.
- `executeDom`: corre pasos en orden; se detiene en el primer fallo con `failedStep`+`error`; éxito devuelve `ok:true` + resultados.
- dispatcher: `execute_dom` rutea a `chrome.tabs.sendMessage(tabId, …)` y devuelve la respuesta del content.
- `parseIncomingCommand`: acepta `execute_dom` válido (tabId number + steps array); rechaza malformado.

## Versiones

| Versión | Estado | Tema                                                                                                                                                         |
| ------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0.4.0   | ✅     | Intérprete genérico de DOM ops (`fill`/`click`/`waitFor`/`getText`) + comando `execute_dom` ruteado por `tabId` (unit verde; live pendiente de mapi v0.20.0) |
