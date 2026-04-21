'use client'

import { useVatLookup } from '@/hooks/use-vat-lookup'

type VatLookupFieldProps = {
  value: string
  onChange: (value: string) => void
  onFound?: (data: { ragione_sociale: string | null; indirizzo: string | null }) => void
  country?: string
  className?: string
  inputClassName?: string
  placeholder?: string
}

export function VatLookupField({
  value,
  onChange,
  onFound,
  country = 'IT',
  className,
  inputClassName,
  placeholder = 'P.IVA / VAT Number',
}: VatLookupFieldProps) {
  const { lookup, loading, result, error } = useVatLookup()

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    onChange(val)
    lookup(val, country)
  }

  function handleApply() {
    if (result?.found && onFound) {
      onFound({ ragione_sociale: result.ragione_sociale, indirizzo: result.indirizzo })
    }
  }

  return (
    <div className={className}>
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          className={inputClassName}
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#22d3ee] border-t-transparent" />
          </div>
        )}
      </div>

      {result?.found && (
        <div className="mt-2 rounded-xl border border-[#22d3ee]/30 bg-[#22d3ee]/5 p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="mb-0.5 text-xs font-medium text-[#22d3ee]">Trovato ✓</p>
              {result.ragione_sociale && (
                <p className="truncate text-sm font-medium text-app-fg">{result.ragione_sociale}</p>
              )}
              {result.indirizzo && (
                <p className="mt-0.5 truncate text-xs text-app-fg-muted">{result.indirizzo}</p>
              )}
            </div>
            {onFound && (
              <button
                type="button"
                onClick={handleApply}
                className="shrink-0 rounded-lg bg-[#22d3ee] px-3 py-1.5 text-xs font-semibold text-[#0a192f] transition hover:opacity-90 active:scale-95"
              >
                Usa questi dati
              </button>
            )}
          </div>
        </div>
      )}

      {result && !result.found && (
        <p className="mt-1.5 text-xs text-amber-400">P.IVA non trovata nei registri pubblici</p>
      )}

      {error && <p className="mt-1.5 text-xs text-rose-400">{error}</p>}
    </div>
  )
}
