/**
 * Errore tecnico nel log email: anteprima compatta, testo completo apribile (native `<details>`, no JS).
 */
function logErrorPreview(text: string, maxLen = 88): string {
  const t = text.trim()
  if (t.length <= maxLen) return t
  return `${t.slice(0, maxLen)}…`
}

export function LogErroreDettaglioBlock({
  text,
  isSuggest,
}: {
  text: string
  /** Stato fornitore_suggerito — tinta viola */
  isSuggest: boolean
}) {
  const trimmed = text.trim()
  const needsExpand = trimmed.length > 88 || trimmed.includes('\n')

  const shortMono = `break-words font-mono text-[10px] leading-snug ${
    isSuggest ? 'text-violet-200' : 'text-red-200/95'
  }`

  if (!needsExpand) {
    return <p className={shortMono}>{trimmed}</p>
  }

  const wrap = isSuggest
    ? 'border-violet-500/25 bg-violet-950/35'
    : 'border-red-500/30 bg-red-950/40'
  const previewCls = isSuggest ? 'text-violet-200/95' : 'text-red-200/95'

  return (
    <details
      className={`max-w-full rounded-md border px-2.5 py-2 ${wrap} [&_summary::-webkit-details-marker]:hidden`}
    >
      <summary
        className={`flex cursor-pointer list-none items-start gap-1.5 font-mono text-[10px] leading-snug ${previewCls} select-none hover:opacity-95`}
        title={trimmed}
      >
        <span className="mt-0.5 shrink-0 text-[9px] text-app-fg-muted opacity-80" aria-hidden>
          ▸
        </span>
        <span className="min-w-0 flex-1 line-clamp-1 break-all">{logErrorPreview(trimmed, 88)}</span>
      </summary>
      <pre
        className={`mt-2 max-h-40 overflow-x-auto overflow-y-auto whitespace-pre-wrap border-t border-white/10 pt-2 font-mono text-[10px] leading-relaxed ${
          isSuggest ? 'text-violet-100/95' : 'text-red-100/95'
        }`}
      >
        {trimmed}
      </pre>
    </details>
  )
}
