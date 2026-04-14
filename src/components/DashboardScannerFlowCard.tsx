import Link from 'next/link'
import type { Translations } from '@/lib/translations'

/**
 * Riepilogo giornaliero del flusso Scanner (eventi `scanner_flow_events`), non collegato alle schede bolle/fatture.
 */
export default function DashboardScannerFlowCard({
  summary,
  t,
}: {
  summary: { aiElaborate: number; archiviate: number }
  t: Translations
}) {
  return (
    <section
      className="mt-3 block rounded-2xl border-2 border-cyan-400/40 bg-slate-900/95 px-4 py-3 shadow-xl shadow-black/40"
      aria-label={t.dashboard.scannerFlowCardTitle}
    >
      <div className="flex flex-col gap-0.5">
        <h2 className="text-[11px] font-semibold uppercase tracking-wide text-cyan-200">
          {t.dashboard.scannerFlowCardTitle}
        </h2>
        <p className="text-[11px] leading-snug text-slate-300">{t.dashboard.scannerFlowCardHint}</p>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="flex flex-col items-center justify-center rounded-xl border border-amber-400/40 bg-amber-950/50 px-2 py-2.5 text-center">
          <span className="text-2xl font-bold tabular-nums text-amber-50">{summary.aiElaborate}</span>
          <span className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-200/90">
            {t.dashboard.scannerFlowAiElaborate}
          </span>
        </div>
        <div className="flex flex-col items-center justify-center rounded-xl border border-emerald-400/40 bg-emerald-950/45 px-2 py-2.5 text-center">
          <span className="text-2xl font-bold tabular-nums text-emerald-50">{summary.archiviate}</span>
          <span className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-200/90">
            {t.dashboard.scannerFlowArchived}
          </span>
        </div>
      </div>
      <Link
        href="/bolle/new"
        className="mt-3 flex min-h-[44px] w-full items-center justify-center rounded-xl border border-cyan-500/40 bg-gradient-to-r from-cyan-500/20 to-violet-500/15 text-sm font-bold text-cyan-100 transition-colors hover:border-cyan-400/55 hover:from-cyan-500/30 active:scale-[0.99] touch-manipulation"
      >
        {t.dashboard.scannerFlowOpenScanner}
      </Link>
    </section>
  )
}
