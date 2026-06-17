# pipes

Aquí vive cada pipe de `mapi_v2`. Un pipe = un **proceso de fondo sobre BullMQ**: un worker que consume y/o produce una cola. Corre sobre el `queue` del core.

> Arquitectura core+plugins+pipes, reglas y cómo se inserta un pipe: [`../README.md`](../README.md).

Cada pipe es un NestModule que se monta en el core como un plugin (misma lista del registro). La diferencia es de **tipo**, no de mecanismo:

- **plugin** = integración de dominio (expone rutas, dueño de tablas, puede contener pipes).
- **pipe** = proceso encolado (registra su cola con `BullModule.registerQueue`, define su worker/processor, corre en background).

```
pipes/<pipe>/
├── src/           ← su worker + su cola (BullMQ); usa el core vía servicios inyectados
├── README.md      ← la cara pública: qué cola consume/produce y el shape del payload. NO el cómo.
└── roadmap/       ← versiones + TDD del pipe
```

**Regla:** un pipe se comunica con plugins y otros pipes **solo por cola + contrato**, nunca importando código. El core no sabe qué hace; solo provee la conexión BullMQ.

Un pipe que pertenece claramente a un dominio puede vivir dentro de su plugin (`plugins/<plugin>/src/...`). Se pone en `pipes/<pipe>/` cuando es independiente o lo comparten varios plugins.

Pipes planeados: (vacío — se crean cuando se construya el primero).
