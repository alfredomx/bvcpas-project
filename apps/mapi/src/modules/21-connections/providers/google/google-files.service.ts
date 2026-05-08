import { Inject, Injectable, Optional } from '@nestjs/common'
import { ConnectionAuthError } from '../../connection.errors'
import { ConnectionTokenRefreshService } from '../../connection-token-refresh.service'
import { GOOGLE_FETCH } from './google.provider'

const DRIVE_FILES_URL = 'https://www.googleapis.com/drive/v3/files'
const FOLDER_MIME = 'application/vnd.google-apps.folder'

interface DriveFileRaw {
  id: string
  name: string
  mimeType: string
  size?: string
  modifiedTime?: string
}

interface DriveListResponse {
  files: DriveFileRaw[]
  nextPageToken?: string
}

export interface FileEntry {
  id: string
  name: string
  mimeType: string
  type: 'file' | 'folder'
  size: number | null
  modified: string | null
}

export interface ListFilesResult {
  items: FileEntry[]
  nextPageToken: string | null
}

@Injectable()
export class GoogleFilesService {
  constructor(
    private readonly tokens: ConnectionTokenRefreshService,
    @Optional() @Inject(GOOGLE_FETCH) private readonly fetchFn: typeof fetch = fetch,
  ) {}

  async listFolder(
    connectionId: string,
    userId: string,
    folderId: string,
    pageSize: number,
  ): Promise<ListFilesResult> {
    const accessToken = await this.tokens.getValidAccessToken(connectionId, userId)

    const params = new URLSearchParams({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'files(id,name,mimeType,size,modifiedTime),nextPageToken',
      pageSize: String(pageSize),
      orderBy: 'folder,name',
    })

    const res = await this.fetchFn(`${DRIVE_FILES_URL}?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!res.ok) {
      const errBody = await res.text().catch(() => '')
      throw new ConnectionAuthError(`Google Drive list falló (${res.status}): ${errBody}`)
    }

    const data = (await res.json()) as DriveListResponse

    const items: FileEntry[] = (data.files ?? []).map((f) => ({
      id: f.id,
      name: f.name,
      mimeType: f.mimeType,
      type: f.mimeType === FOLDER_MIME ? ('folder' as const) : ('file' as const),
      size: f.size !== undefined ? Number.parseInt(f.size, 10) : null,
      modified: f.modifiedTime ?? null,
    }))

    return {
      items,
      nextPageToken: data.nextPageToken ?? null,
    }
  }
}
