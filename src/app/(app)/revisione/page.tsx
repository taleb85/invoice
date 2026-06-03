import { redirect } from 'next/navigation'
import { unwrapSearchParams } from '@/lib/unwrap-next-search-params'
import { withFiscalYearQuery } from '@/lib/fiscal-link'

export const dynamic = 'force-dynamic'

/** Inbox urgente unificata in `/inbox-ai?tab=panoramica`. */
export default async function RevisioneRedirectPage(props: {
  searchParams?: Promise<{ fy?: string }>
}) {
  const searchParams = await unwrapSearchParams(props.searchParams)
  redirect(withFiscalYearQuery('/inbox-ai', searchParams.fy, { tab: 'panoramica' }))
}
