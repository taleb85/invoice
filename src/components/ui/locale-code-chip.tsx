/** Chip compatto ISO (due lettere) al posto delle bandiere. Usabile anche da Server Components. */
export function LocaleCodeChip({
  code,
  className = 'inline-flex h-7 min-w-[1.75rem] items-center justify-center rounded border border-white/15 bg-white/[0.06] px-1 text-[10px] font-bold uppercase leading-none text-app-fg',
}: {
  code: string
  className?: string
}) {
  return <span className={className}>{code.slice(0, 2).toUpperCase()}</span>
}
