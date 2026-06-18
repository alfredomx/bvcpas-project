# `plugins/kiro-bridge`

Plugin de transporte de `mapi_v2`. Es el **bridge WebSocket mapi↔kiro** (la extensión de Chrome): mapi manda comandos (`execute_fetch`, `list_tabs`, `execute_dom`, `open_tab`, `close_tab`…) y kiro los ejecuta en la **sesión viva** del navegador del operador y responde.

Design B: mapi tiene la lógica (recetas/selectores); kiro es un ejecutor tonto.

- Gateway WS en `/bridge` (sobre `ws`, no socket.io). Auth: `hello` con el JWT del operador.
- Publica `BRIDGE_COMMAND_PORT` en el core (`@Global`): otros plugins (`bank-downloader`) lo inyectan sin importar este plugin (D-core-027).

**Roadmap, proceso y decisiones:** [`roadmap/README.md`](roadmap/README.md).
