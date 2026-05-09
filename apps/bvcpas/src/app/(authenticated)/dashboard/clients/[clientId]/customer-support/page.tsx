'use client'

import { use } from 'react'

import { CustomerSupportScreen } from '@/modules/12-customer-support/components/customer-support-screen'

export default function CustomerSupportPage({
  params,
}: {
  params: Promise<{ clientId: string }>
}) {
  const { clientId } = use(params)
  return <CustomerSupportScreen clientId={clientId} />
}
