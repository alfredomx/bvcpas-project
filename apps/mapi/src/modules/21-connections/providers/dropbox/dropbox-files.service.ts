import { Inject, Injectable, Optional } from '@nestjs/common'
import { ConnectionAuthError } from '../../connection.errors'
import { ConnectionTokenRefreshService } from '../../connection-token-refresh.service'
import { DROPBOX_FETCH } from './dropbox.provider'

const DBX_LIST_FOLDER_URL = 'https://api.dropboxapi.com/2/files/list_folder'

interface DropboxListFolderRawEntry {
  '.tag': 'file' | 'folder' | 'deleted'
  id?: string
  name: string
  path_lower?: string
  size?: number
  client_modified?: string
  server_modified?: string
}

interface DropboxListFolderResponse {
  entries: DropboxListFolderRawEntry[]
  cursor: string
  has_more: boolean
}

export interface FileEntry {
  type: 'file' | 'folder'
  name: string
  path: string
  id: string
  size: number | null
  modified: string | null
}

export interface ListFilesResult {
  items: FileEntry[]
  cursor: string | null
  has_more: boolean
}

@Injectable()
export class DropboxFilesService {
  constructor(
    private readonly tokens: ConnectionTokenRefreshService,
    @Optional() @Inject(DROPBOX_FETCH) private readonly fetchFn: typeof fetch = fetch,
  ) {}

  async listFolder(connectionId: string, userId: string, path: string): Promise<ListFilesResult> {
    const accessToken = await this.tokens.getValidAccessToken(connectionId, userId)

    // Dropbox quiere "" para raíz (no "/").
    const cleanPath = path === '/' ? '' : path

    const res = await this.fetchFn(DBX_LIST_FOLDER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        path: cleanPath,
        recursive: false,
        include_deleted: false,
        include_has_explicit_shared_members: false,
      }),
    })

    if (!res.ok) {
      const errBody = await res.text().catch(() => '')
      throw new ConnectionAuthError(`Dropbox list_folder falló (${res.status}): ${errBody}`)
    }

    const data = (await res.json()) as DropboxListFolderResponse

    const items: FileEntry[] = data.entries
      .filter((e) => e['.tag'] !== 'deleted')
      .map((e) => ({
        type: e['.tag'] === 'folder' ? ('folder' as const) : ('file' as const),
        name: e.name,
        path: e.path_lower ?? '',
        id: e.id ?? '',
        size: e.size ?? null,
        modified: e.server_modified ?? e.client_modified ?? null,
      }))

    return {
      items,
      cursor: data.has_more ? data.cursor : null,
      has_more: data.has_more,
    }
  }
}
