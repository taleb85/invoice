/**
 * Accento a L come le tile KPI scheda fornitore: `border-l` + `border-t` (curva nativa)
 * e gradiente sulla fascia superiore da `left-*` per non duplicare l’arco del raggio.
 */
function KpiLAccentOverlay({
  accentHex,
  edgePx = 4,
}: {
  accentHex: string
  /** Spessore braccia L (px). Mobile compatto: 3. */
  edgePx?: 3 | 4
}) {
  const leftGapClass = edgePx === 3 ? 'left-3' : 'left-4'
  return (
    <>
      <div
        className="pointer-events-none absolute inset-0 z-0 box-border rounded-2xl border-transparent"
        style={{
          borderLeftWidth: edgePx,
          borderTopWidth: edgePx,
          borderLeftStyle: 'solid',
          borderTopStyle: 'solid',
          borderRightWidth: 0,
          borderBottomWidth: 0,
          borderLeftColor: accentHex,
          borderTopColor: accentHex,
          boxShadow: `4px 0 16px ${accentHex}38, 0 0 12px ${accentHex}28`,
        }}
        aria-hidden
      />
      <div
        className={`pointer-events-none absolute right-0 top-0 z-0 h-1 ${leftGapClass}`}
        style={{
          background: `linear-gradient(90deg, ${accentHex} 0%, ${accentHex} 28%, ${accentHex}66 52%, transparent 100%)`,
        }}
        aria-hidden
      />
    </>
  )
}

export default KpiLAccentOverlay
