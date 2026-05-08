'use client'

type Props = {
  value: string
  onChange: (v: string) => void
  label: string
  /** Se true mostra il badge verde «Riconosciuto dall'OCR». */
  dateFromOcr: boolean
  /** Testo per il badge OCR (passato dalle traduzioni). */
  ocrRecognizedLabel: string
  /** Testo alternativo visualizzato quando dateFromOcr è false (es. «Data dal documento»). */
  hintLabel?: string
  /** Se true mostra uno spinner di scansione nell'header (es. fattura form). */
  scanning?: boolean
  /** Testo per lo spinner di scansione. */
  scanningLabel?: string
  /** Testo per la riga footer «Data di caricamento». */
  uploadDateLabel: string
  /** Testo per la riga footer «— automatica». */
  uploadDateAutomatic: string
  /** Data odierna formattata per il footer. */
  todayFormatted: string
  /** Classe per l'input. */
  inputClassName?: string
  /** Classe per il wrapper esterno (es. AuroraPanelShell o app-card). */
  wrapperClassName?: string
  /** Classe per il div interno (default dipende da dateFromOcr). */
  innerClassName?: string
  /** Classe per la riga footer (default: 'flex items-center justify-between border-t border-app-line-22 app-workspace-inset-bg px-5 py-3'). */
  footerClassName?: string
}

export default function DataFieldWithOcrBadge({
  value,
  onChange,
  label,
  dateFromOcr,
  ocrRecognizedLabel,
  hintLabel,
  scanning,
  scanningLabel,
  uploadDateLabel,
  uploadDateAutomatic,
  todayFormatted,
  inputClassName = '-mx-1 w-full border-0 bg-transparent py-1 text-base text-app-fg [color-scheme:dark] focus:outline-none focus:ring-0',
  wrapperClassName,
  innerClassName,
  footerClassName = 'flex items-center justify-between border-t border-app-line-22 app-workspace-inset-bg px-5 py-3',
}: Props) {
  return (
    <div className={wrapperClassName ?? ''}>
      <div className={innerClassName ?? `p-5 transition-colors ${dateFromOcr ? 'bg-emerald-500/10' : ''}`}>
        <div className="mb-1.5 flex items-center justify-between">
          <label className="min-w-0 shrink text-xs font-bold uppercase tracking-wider text-app-fg-muted">
            {label}
          </label>
          {scanning ? (
            <span className="flex items-center gap-1 text-xs text-app-fg-muted">
              <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
              {scanningLabel ?? 'Analisi…'}
            </span>
          ) : dateFromOcr ? (
            <span className="flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-bold text-emerald-200 ring-1 ring-emerald-400/40">
              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
              </svg>
              {ocrRecognizedLabel}
            </span>
          ) : hintLabel ? (
            <span className="text-[11px] font-semibold text-app-fg-muted">{hintLabel}</span>
          ) : null}
        </div>
        <input
          type="date"
          required
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputClassName}
        />
      </div>
      <div className={footerClassName}>
        <span className="text-xs font-bold uppercase tracking-wider text-app-fg-muted">
          {uploadDateLabel}
        </span>
        <span className="text-sm font-bold text-app-fg">
          {todayFormatted} — {uploadDateAutomatic}
        </span>
      </div>
    </div>
  )
}
