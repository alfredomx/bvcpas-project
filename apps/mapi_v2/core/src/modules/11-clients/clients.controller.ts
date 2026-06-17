import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { z } from 'zod'
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe'
import type { Client } from '@/core/db/schema/clients'
import { ClientsService } from './clients.service'
import {
  createClientSchema,
  listClientsQuerySchema,
  updateClientSchema,
  type CreateClientDto,
  type ListClientsQuery,
  type UpdateClientDto,
} from './dto/clients.dto'

const uuidSchema = z.string().uuid()

/**
 * CRUD de clientes bajo `/v1/clients`. Protegido por el `AdminGuard` global
 * (D-core-020) — todo requiere token admin. Sin DELETE físico: la baja es
 * `PATCH { status: 'offboarded' }`.
 */
@Controller('clients')
export class ClientsController {
  constructor(private readonly clients: ClientsService) {}

  @Get()
  list(
    @Query(new ZodValidationPipe(listClientsQuerySchema)) query: ListClientsQuery,
  ): Promise<{ rows: Client[]; total: number }> {
    return this.clients.list(query)
  }

  @Get(':id')
  getById(@Param('id', new ZodValidationPipe(uuidSchema)) id: string): Promise<Client> {
    return this.clients.getById(id)
  }

  @Post()
  create(@Body(new ZodValidationPipe(createClientSchema)) body: CreateClientDto): Promise<Client> {
    return this.clients.create(body)
  }

  @Patch(':id')
  update(
    @Param('id', new ZodValidationPipe(uuidSchema)) id: string,
    @Body(new ZodValidationPipe(updateClientSchema)) body: UpdateClientDto,
  ): Promise<Client> {
    return this.clients.update(id, body)
  }
}
