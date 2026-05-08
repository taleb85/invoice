'use client'

import { useEffect } from 'react'
import { useActiveOperator } from '@/lib/active-operator-context'

type Props = {
  value: string
  onChange: (v: string) => void
  label?: string
  placeholder?: string
  /** Mostra il campo solo quando show=true (es. dopo che un file è stato caricato). */
  show: boolean
  /** Classe per il contenitore esterno (es. AuroraPanelShell o app-card). */
  wrapperClassName?: string
  /** Classe per il div interno (default: 'p-5'). */
  innerClassName?: string
  /** Classe per l'input. */
  inputClassName?: string
  /** Se true aggiunge autoFocus all'input. */
  autoFocus?: boolean
  /** Se true usa toUpperCase in onChange (default bolla form). */
  upperCase?: boolean
}

export default function RegistratoDaField({
  value,
  onChange,
  label = 'Registrato da',
  placeholder = 'Nome di chi ha registrato…',
  show,
  wrapperClassName,
  innerClassName = 'p-5',
  inputClassName = '-mx-1 w-full border-0 bg-transparent py-1 text-base text-app-fg placeholder:text-app-fg-placeholder focus:outline-none focus:ring-0',
  autoFocus,
  upperCase = false,
}: Props) {
  const { activeOperator } = useActiveOperator()

  useEffect(() => {
    if (activeOperator?.full_name && !value) {
      onChange(activeOperator.full_name)
    }
  }, [activeOperator, onChange, value])

  if (!show) return null

  return (
    <div className={wrapperClassName ?? ''}>
      <div className={innerClassName}>
        <label className="mb-3 block text-xs font-semibold uppercase tracking-wide text-app-fg-muted">
          {label}
        </label>
        <input
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(upperCase ? e.target.value.toUpperCase() : e.target.value)}
          autoCapitalize={upperCase ? 'characters' : undefined}
          autoCorrect={upperCase ? 'off' : undefined}
          spellCheck={upperCase ? false : undefined}
          autoFocus={autoFocus}
          className={inputClassName}
        />
      </div>
    </div>
  )
}
