'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { BollaStato } from '@/types'

export default function ToggleStato({ id, stato }: { id: string; stato: BollaStato }) {
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

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors disabled:opacity-50 ${
        current === 'completato'
          ? 'bg-green-100 text-green-700 border-green-200 hover:bg-green-200'
          : 'bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-200'
      }`}
    >
      {current}
    </button>
  )
}
