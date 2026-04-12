'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { BollaStato } from '@/types'
import { useT } from '@/lib/use-t'

export default function ToggleStato({ id, stato }: { id: string; stato: BollaStato }) {
  const t = useT()
  const [current, setCurrent] = useState<BollaStato>(stato)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const toggle = async () => {
    setLoading(true)
    const next: BollaStato = current === 'in attesa' ? 'completato' : 'in attesa'
    await supabase.from('bolle').update({ stato: next }).eq('id', id)
    setCurrent(next)
    setLoading(false)
    router.refresh()
  }

  const label = current === 'completato' ? t.status.completato : t.status.inAttesa

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={loading}
      aria-label={label}
      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
        current === 'completato'
          ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25'
          : 'border-amber-500/40 bg-amber-500/15 text-amber-200 hover:bg-amber-500/25'
      }`}
    >
      {label}
    </button>
  )
}
