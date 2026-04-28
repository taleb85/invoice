import { NextResponse } from 'next/server'

/**
 * Vercel Cron invoca questa route con `Authorization: Bearer CRON_SECRET`.
 * Delega a `GET /api/scan-emails` (stessa coda e stessa logica IMAP per tutte le sedi configurate).
 */
export const maxDuration = 300

function internalAppBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (explicit) return explicit.replace(/\/$/, '')
  const vercel = process.env.VERCEL_URL?.trim()
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, '')}`
  return 'http://127.0.0.1:3000'
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET non configurato' }, { status: 500 })
  }

  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${secret}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const base = internalAppBaseUrl()
  const scanUrl = `${base}/api/scan-emails`

  try {
    const res = await fetch(scanUrl, {
      method: 'GET',
      headers: { Authorization: `Bearer ${secret}` },
      cache: 'no-store',
    })

    const data: Record<string, unknown> = await res.json().catch(() => ({}))

    if (!res.ok) {
      return NextResponse.json(
        { success: false, error: data.error ?? data ?? res.statusText },
        { status: res.status >= 400 ? res.status : 502 },
      )
    }

    const processed =
      typeof data.mailsProcessed === 'number'
        ? data.mailsProcessed
        : typeof data.ricevuti === 'number'
          ? data.ricevuti
          : 0

    return NextResponse.json({
      success: true,
      processed,
      ricevuti: data.ricevuti,
      ignorate: data.ignorate,
      bozzeCreate: data.bozzeCreate,
      mailsFound: data.mailsFound,
      mailsProcessed: data.mailsProcessed,
    })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'fetch failed'
    console.error('[cron/sync-emails]', message)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
