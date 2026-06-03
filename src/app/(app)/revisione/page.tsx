import { redirect } from 'next/navigation'
import { unwrapSearchParams } from '@/lib/unwrap-next-search-params'
import { withFiscalYearQuery } from '@/lib/fiscal-link'

export const dynamic = 'force-dynamic'

/** Inbox urgente unificata in `/inbox-ai?tab=panoramica`. */
export default async function RevisioneRedirectPage(props: {
  searchParams?: Promise<{ fy?: string }>
}) {
  const searchParams = await unwrapSearchParams(props.searchParams)
  const fyParsed = searchParams.fy ? Number.parseInt(searchParams.fy, 10) : NaN
  const fy = Number.isFinite(fyParsed) ? fyParsed : undefined
  redirect(withFiscalYearQuery('/inbox-ai', fy, { tab: 'panoramica' }))
}
