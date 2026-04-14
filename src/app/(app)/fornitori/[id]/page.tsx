import { Suspense } from 'react'
import FluxoSupplierProfileLoading from '@/components/FluxoSupplierProfileLoading'
import FornitoreDetailPage from './fornitore-detail-client'
import { getT } from '@/lib/locale-server'

export const dynamic = 'force-dynamic'

export default async function FornitoreDetailRoutePage() {
  const t = await getT()
  return (
    <Suspense
      fallback={
        <FluxoSupplierProfileLoading message={t.fornitori.loadingProfile} tagline={t.ui.tagline} />
      }
    >
      <FornitoreDetailPage />
    </Suspense>
  )
}
