import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { ZodValidationPipe } from '../../../../common/pipes/zod-validation.pipe'
import { CurrentUser } from '../../../../core/auth/decorators/current-user.decorator'
import type { SessionContext } from '../../../../core/auth/sessions.service'
import { z } from 'zod'
import { DropboxFilesService } from './dropbox-files.service'
import { DropboxListFilesQueryDto, DropboxListFilesResponseDto } from './dto/dropbox.dto'

const ListQuerySchema = z.object({
  path: z.string().default(''),
})

@ApiTags('OAuth - Dropbox')
@ApiBearerAuth('bearer')
@Controller('connections/:id/dropbox')
export class DropboxFilesController {
  constructor(private readonly files: DropboxFilesService) {}

  @Get('files')
  @ApiOperation({
    summary: 'GET /v1/connections/:id/dropbox/files',
    description:
      'Lista archivos/carpetas del Dropbox del owner de la conexión. Default `path=""` (raíz). Solo devuelve la página actual; cursor para paginación incremental viene en `cursor` cuando `has_more=true`.',
  })
  @ApiResponse({ status: 200, type: DropboxListFilesResponseDto })
  @ApiResponse({ status: 404, description: 'Conexión no encontrada o no pertenece al user' })
  async list(
    @Param('id', ParseUUIDPipe) connectionId: string,
    @Query(new ZodValidationPipe(ListQuerySchema)) query: DropboxListFilesQueryDto,
    @CurrentUser() user: SessionContext,
  ): Promise<DropboxListFilesResponseDto> {
    const result = await this.files.listFolder(connectionId, user.userId, query.path)
    return result
  }
}
