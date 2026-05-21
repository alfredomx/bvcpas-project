// Pantalla pública para que el cliente final clasifique sus uncats.
// Sin auth: el token de la URL es el único identificador.

import { PublicUncatsScreen } from '@/modules/16-public-uncats/components/public-uncats-screen'

interface PageProps {
  params: Promise<{ token: string }>
}

export default async function Page({ params }: PageProps) {
  const { token } = await params
  return <PublicUncatsScreen token={token} />
}
