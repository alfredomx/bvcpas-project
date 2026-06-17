import { Global, Module } from '@nestjs/common'
import { ClientsRepository } from './clients.repository'
import { ClientsService } from './clients.service'

/**
 * Módulo de la entidad central `clients`. `@Global` + exporta `ClientsService`
 * para que cualquier plugin lo inyecte sin importar el módulo (modelo WordPress:
 * el core es dueño de la entidad; los plugins la consumen).
 *
 * El controller (`/v1/clients`) se agrega en el siguiente commit.
 */
@Global()
@Module({
  providers: [ClientsRepository, ClientsService],
  exports: [ClientsService],
})
export class ClientsModule {}
