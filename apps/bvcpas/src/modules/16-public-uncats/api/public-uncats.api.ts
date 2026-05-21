// Wrappers para los endpoints públicos de uncats.
//
// IMPORTANTE: usan `fetch` directo, NO `api.GET` del SDK tipado, porque
// el cliente HTTP global inyecta `Authorization: Bearer <token>` con la
// sesión del operador si la hay en sessionStorage. La página pública
// debe llamar a mapi siempre sin headers de auth — el token de la URL
// es el único identificador.

export type PublicCategory = 'uncategorized_expense' | 'uncategorized_income'
export type ClientTransactionsFilter = 'all' | 'expense' | 'income'

export interface PublicUncatsResponseItem {
  id: string
  qbo_txn_type: string
  txn_date: string
  docnum: string | null
  vendor_name: string | null
  memo: string | null
  split_account: string | null
  category: PublicCategory
  amount: string
  response: {
    client_note: string
    completed: boolean
    responded_at: string
  } | null
}

export interface PublicUncatsResponse {
  client: {
    id: string
    legal_name: string
    transactions_filter: ClientTransactionsFilter
  }
  items: PublicUncatsResponseItem[]
  total: number
}

export interface ApiError extends Error {
  statusCode: number
  code: string
}

function buildBaseUrl(): string {
  const base = process.env.NEXT_PUBLIC_API_URL
  if (!base) throw new Error('NEXT_PUBLIC_API_URL is not defined')
  return base.replace(/\/$/, '')
}

async function throwFromResponse(response: Response): Promise<never> {
  let code = 'UNKNOWN'
  let message = `Request failed with status ${response.status}`
  try {
    const body = (await response.json()) as {
      code?: string
      message?: string
    }
    if (typeof body.code === 'string') code = body.code
    if (typeof body.message === 'string') message = body.message
  } catch {
    // No JSON body — keep defaults.
  }
  const err = new Error(message) as ApiError
  err.statusCode = response.status
  err.code = code
  throw err
}

export async function getPublicUncats(
  token: string,
): Promise<PublicUncatsResponse> {
  const response = await fetch(
    `${buildBaseUrl()}/v1/public/uncats/${encodeURIComponent(token)}`,
    { method: 'GET' },
  )
  if (!response.ok) await throwFromResponse(response)
  return (await response.json()) as PublicUncatsResponse
}

export async function savePublicNote(
  token: string,
  txnId: string,
  body: { note: string },
): Promise<void> {
  const response = await fetch(
    `${buildBaseUrl()}/v1/public/uncats/${encodeURIComponent(
      token,
    )}/${encodeURIComponent(txnId)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  )
  if (!response.ok) await throwFromResponse(response)
}

export async function deletePublicNote(
  token: string,
  txnId: string,
): Promise<void> {
  const response = await fetch(
    `${buildBaseUrl()}/v1/public/uncats/${encodeURIComponent(
      token,
    )}/${encodeURIComponent(txnId)}`,
    { method: 'DELETE' },
  )
  if (!response.ok) await throwFromResponse(response)
}
