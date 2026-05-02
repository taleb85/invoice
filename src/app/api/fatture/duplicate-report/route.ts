import { NextResponse } from 'next/server'
import { createServiceClient, getRequestAuth } from '@/utils/supabase/server'
import { runDuplicateFattureReport } from '@/lib/duplicate-fatture-report'

export const dynamic = 'force-dynamic'
/** Scan lunghi: evita timeout su Vercel (ignorato altrove). */
export const maxDuration = 120

const NDJSON = 'application/x-ndjson'

/**
 * GET — report fatture duplicate (RLS).
 * Con `Accept: application/x-ndjson` emette righe JSON (`progress` per ogni batch, poi `done`).
 */
export async function GET(request: Request) {
  const { user } = await getRequestAuth()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()

  const accept = request.headers.get('accept') ?? ''
  const url = new URL(request.url)
  const wantsNdjson = accept.includes(NDJSON) || url.searchParams.get('stream') === '1'

  if (!wantsNdjson) {
    try {
      const { groups, scannedRows, truncated } = await runDuplicateFattureReport(
        supabase,
        undefined,
        request.signal,
      )
      return NextResponse.json({ ok: true as const, groups, scannedRows, truncated })
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        return NextResponse.json({ error: 'Operazione annullata' }, { status: 499 })
      }
      const msg = e instanceof Error ? e.message : 'Errore sconosciuto'
      console.error('[duplicate-report]', msg)
      return NextResponse.json({ error: msg }, { status: 500 })
    }
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const yieldLoop = () => new Promise<void>((r) => setTimeout(r, 0))
      const write = (obj: unknown) => {
        if (request.signal.aborted) {
          throw new DOMException('Operazione annullata', 'AbortError')
        }
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(obj)}\n`))
        } catch {
          throw new DOMException('Operazione annullata', 'AbortError')
        }
      }
      try {
        write({ type: 'progress' as const, scannedSoFar: 0, sample: [] })
        const result = await runDuplicateFattureReport(
          supabase,
          (p) => {
            write({ type: 'progress' as const, ...p })
          },
          request.signal,
        )
        await yieldLoop()
        write({ type: 'done' as const, ok: true as const, ...result })
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') {
          try {
            write({ type: 'error' as const, error: 'Operazione annullata' })
          } catch {
            /* client già disconnesso */
          }
          return
        }
        const msg = e instanceof Error ? e.message : 'Errore sconosciuto'
        console.error('[duplicate-report]', msg)
        try {
          write({ type: 'error' as const, error: msg })
        } catch {
          /* stream chiuso */
        }
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': `${NDJSON}; charset=utf-8`,
      'Cache-Control': 'no-store',
    },
  })
}
