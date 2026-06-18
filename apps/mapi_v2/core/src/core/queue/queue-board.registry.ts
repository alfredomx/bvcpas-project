import { Injectable } from '@nestjs/common'

/**
 * Registro de colas para el dashboard (bull-board).
 *
 * El core monta UN bull-board (en el bootstrap) pero NO conoce las colas: cada
 * una pertenece a un plugin/pipe (D-core: cero-reach). Para no hardcodear nombres
 * de plugin en el core, cada plugin/pipe que declara una cola (`registerQueue`)
 * también registra su NOMBRE aquí. El bootstrap lee la lista, resuelve cada cola
 * del contenedor (`getQueueToken`) y la agrega al board.
 *
 * `@Global` (vía `QueueModule`): cualquier plugin lo inyecta sin importar el core.
 * El registro se llena en los CONSTRUCTORES de los providers (corren durante
 * `NestFactory.create`), así que ya está completo cuando el bootstrap lo lee,
 * antes de `app.listen`.
 */
@Injectable()
export class QueueBoardRegistry {
  private readonly names = new Set<string>()

  /** Da de alta el nombre de una cola para que aparezca en el dashboard. */
  register(queueName: string): void {
    this.names.add(queueName)
  }

  /** Nombres de las colas registradas (orden de inserción). */
  list(): string[] {
    return [...this.names]
  }
}
