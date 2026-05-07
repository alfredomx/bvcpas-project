'use client'

// /dashboard/clients/<clientId> sin tab. Redirige a la última tab
// visitada para ese cliente (localStorage); si no hay, a customer-support
// por default.

import { use, useEffect } from 'react'
import { useRouter } from 'next/navigation'

import { DEFAULT_TAB_SLUG, findTabBySlug } from '@/modules/15-app-shell/lib/tabs'
import { getLastTab } from '@/modules/15-app-shell/hooks/use-last-tab'

export default function ClientRootPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = use(params)
  const router = useRouter()

  useEffect(() => {
    const stored = getLastTab(clientId)
    const slug = stored && findTabBySlug(stored) ? stored : DEFAULT_TAB_SLUG
    router.replace(`/dashboard/clients/${clientId}/${slug}`)
  }, [clientId, router])

  return null
}
