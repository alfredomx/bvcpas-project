import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post, Req } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { ThrottlerGuard, Throttle, SkipThrottle } from '@nestjs/throttler'
import { UseGuards } from '@nestjs/common'
import type { Request } from 'express'
import { Public } from '../../common/decorators/public.decorator'
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator'
import type { SessionContext } from '../../core/auth/sessions.service'
import { AuthService } from './auth.service'
import { LoginDto, LoginResponseDto } from './dto/login.dto'
import { MeResponseDto } from './dto/me-response.dto'
import { ChangePasswordDto } from './dto/change-password.dto'
import { LogoutAllResponseDto } from './dto/logout-all-response.dto'

@ApiTags('Auth')
@Controller('auth')
@SkipThrottle()
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Login con email y password',
    description:
      'Devuelve un JWT firmado válido por JWT_EXPIRES_IN (default 7d) + datos del usuario. Crea una sesión revocable en `user_sessions`. Rate limit: 10 intentos/min por IP.',
  })
  @ApiResponse({
    status: 200,
    description: 'Login exitoso',
    type: LoginResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Credenciales inválidas o usuario deshabilitado' })
  @ApiResponse({ status: 429, description: 'Rate limit excedido' })
  async login(@Body() dto: LoginDto, @Req() req: Request): Promise<LoginResponseDto> {
    const userAgent = req.headers['user-agent']
    const ip = req.ip
    const result = await this.auth.login(dto.email, dto.password, userAgent, ip)
    return result
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'Logout de la sesión actual',
    description: 'Revoca solo la sesión correspondiente al JWT que mandó la request.',
  })
  @ApiResponse({ status: 204, description: 'Sesión revocada' })
  async logout(@CurrentUser() user: SessionContext): Promise<void> {
    await this.auth.logout(user.jti, user.userId)
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'Logout de TODAS las sesiones',
    description:
      'Revoca todas las sesiones activas del usuario actual (incluida ésta). Útil si pierde un dispositivo.',
  })
  @ApiResponse({
    status: 200,
    description: 'Sesiones revocadas',
    type: LogoutAllResponseDto,
  })
  async logoutAll(@CurrentUser() user: SessionContext): Promise<LogoutAllResponseDto> {
    const count = await this.auth.logoutAll(user.userId)
    return { sessionsRevokedCount: count }
  }

  @Get('me')
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'Datos del usuario autenticado',
    description: 'Devuelve id, email, nombre, role, status, último login del usuario actual.',
  })
  @ApiResponse({
    status: 200,
    description: 'Datos del usuario',
    type: MeResponseDto,
  })
  async me(@CurrentUser() user: SessionContext): Promise<MeResponseDto> {
    const u = await this.auth.me(user.userId)
    return {
      id: u.id,
      email: u.email,
      fullName: u.fullName,
      role: u.role,
      status: u.status,
      lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
    }
  }

  @Patch('me/password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'Cambiar contraseña del usuario actual',
    description:
      'Requiere old_password correcta. Mínimo 8 caracteres. Revoca todas las otras sesiones del usuario (la actual sigue activa).',
  })
  @ApiResponse({ status: 204, description: 'Contraseña cambiada' })
  @ApiResponse({ status: 400, description: 'old_password incorrecto o new_password débil' })
  async changePassword(
    @CurrentUser() user: SessionContext,
    @Body() dto: ChangePasswordDto,
  ): Promise<void> {
    await this.auth.changePassword(user.userId, dto.oldPassword, dto.newPassword, user.jti)
  }
}
