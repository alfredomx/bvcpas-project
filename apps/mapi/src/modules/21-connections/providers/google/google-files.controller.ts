import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { ZodValidationPipe } from '../../../../common/pipes/zod-validation.pipe'
import { CurrentUser } from '../../../../core/auth/decorators/current-user.decorator'
import type { SessionContext } from '../../../../core/auth/sessions.service'
import { z } from 'zod'
import { GoogleFilesService } from './google-files.service'
import { GoogleListFilesQueryDto, GoogleListFilesResponseDto } from './dto/google.dto'

const ListQuerySchema = z.object({
  folderId: z.string().default('root'),
  pageSize: z.coerce.number().int().min(1).max(1000).default(100),
})

@ApiTags('OAuth - Google')
@ApiBearerAuth('bearer')
@Controller('connections/:id/google')
export class GoogleFilesController {
  constructor(private readonly files: GoogleFilesService) {}

  @Get('files')
  @ApiOperation({
    summary: 'GET /v1/connections/:id/google/files',
    description:
      'Lista archivos/carpetas dentro de una carpeta de Drive del owner. Default `folderId=root` (My Drive). `nextPageToken` para paginación.',
  })
  @ApiResponse({ status: 200, type: GoogleListFilesResponseDto })
  @ApiResponse({ status: 404, description: 'Conexión no encontrada o no pertenece al user' })
  async list(
    @Param('id', ParseUUIDPipe) connectionId: string,
    @Query(new ZodValidationPipe(ListQuerySchema)) query: GoogleListFilesQueryDto,
    @CurrentUser() user: SessionContext,
  ): Promise<GoogleListFilesResponseDto> {
    const result = await this.files.listFolder(
      connectionId,
      user.userId,
      query.folderId,
      query.pageSize,
    )
    return result
  }
}
