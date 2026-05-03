import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { CurrentUser } from '../../../core/auth/decorators/current-user.decorator'
import { Roles } from '../../../core/auth/decorators/roles.decorator'
import type { SessionContext } from '../../../core/auth/sessions.service'
import { AdminUsersService } from './admin-users.service'
import { CreateUserDto } from './dto/create-user.dto'
import { UpdateUserDto } from './dto/update-user.dto'
import {
  CreateUserResponseDto,
  ResetPasswordResponseDto,
  UserDto,
  UsersListResponseDto,
} from './dto/user.dto'

@ApiTags('Admin / Users')
@ApiBearerAuth('bearer')
@Controller('admin/users')
@Roles('admin')
export class AdminUsersController {
  constructor(private readonly adminUsers: AdminUsersService) {}

  @Get()
  @ApiOperation({
    summary: '/v1/admin/users',
    description: 'Listado paginado de todos los usuarios. Solo admin.',
  })
  @ApiResponse({ status: 200, description: 'Lista paginada', type: UsersListResponseDto })
  @ApiResponse({ status: 403, description: 'Permisos insuficientes' })
  async list(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ): Promise<UsersListResponseDto> {
    const pageNum = page ? Math.max(1, Number.parseInt(page, 10)) : 1
    const sizeNum = pageSize ? Math.min(200, Math.max(1, Number.parseInt(pageSize, 10))) : 50

    const result = await this.adminUsers.list(pageNum, sizeNum)

    return {
      items: result.items.map((u) => AdminUsersService.serialize(u)),
      total: result.total,
      page: pageNum,
      pageSize: sizeNum,
    }
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: '/v1/admin/users',
    description:
      'Crea un usuario nuevo. Si initialPassword no se proporciona, se genera una aleatoria y se devuelve UNA vez en la response.',
  })
  @ApiResponse({ status: 201, description: 'Usuario creado', type: CreateUserResponseDto })
  @ApiResponse({ status: 409, description: 'Email ya registrado' })
  @ApiResponse({ status: 400, description: 'Password débil' })
  async create(
    @Body() dto: CreateUserDto,
    @CurrentUser() actor: SessionContext,
  ): Promise<CreateUserResponseDto> {
    const result = await this.adminUsers.create(dto, actor.userId)
    return {
      user: AdminUsersService.serialize(result.user),
      initialPassword: result.initialPassword,
    }
  }

  @Get(':id')
  @ApiOperation({ summary: '/v1/admin/users/:id' })
  @ApiResponse({ status: 200, description: 'Usuario encontrado', type: UserDto })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  async getOne(@Param('id', ParseUUIDPipe) id: string): Promise<UserDto> {
    const user = await this.adminUsers.getById(id)
    return AdminUsersService.serialize(user)
  }

  @Patch(':id')
  @ApiOperation({
    summary: '/v1/admin/users/:id',
    description:
      'Edita full_name, role o status. NO incluye password (usar /reset-password). Cambiar status a disabled NO revoca sesiones existentes — usar /sessions/revoke-all para eso.',
  })
  @ApiResponse({ status: 200, description: 'Usuario editado', type: UserDto })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() actor: SessionContext,
  ): Promise<UserDto> {
    const user = await this.adminUsers.update(id, dto, actor.userId)
    return AdminUsersService.serialize(user)
  }

  @Post(':id/reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '/v1/admin/users/:id/reset-password',
    description:
      'Genera password aleatoria, la asigna y revoca TODAS las sesiones del usuario. Devuelve la temporary password UNA vez.',
  })
  @ApiResponse({
    status: 200,
    description: 'Password reseteada',
    type: ResetPasswordResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  async resetPassword(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: SessionContext,
  ): Promise<ResetPasswordResponseDto> {
    return this.adminUsers.resetPassword(id, actor.userId)
  }
}
