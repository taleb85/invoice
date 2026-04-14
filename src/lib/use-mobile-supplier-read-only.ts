'use client'

import { useEffect, useState } from 'react'
import { useMe } from '@/lib/me-context'
import { useActiveOperator } from '@/lib/active-operator-context'
import { effectiveIsFornitoreGridAdmin } from '@/lib/effective-operator-ui'

const MD_MAX_PX = 767

/**
 * Viewport stretto (&lt; md) e utente senza permesso modifica anagrafica/griglia fornitori
 * (tip. operatore): scheda fornitore in sola lettura su telefono.
 */
export function useMobileSupplierReadOnly(): boolean {
  const { me } = useMe()
  const { activeOperator } = useActiveOperator()
  const [narrow, setNarrow] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia(`(max-width: ${MD_MAX_PX}px)`)
    const sync = () => setNarrow(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  const canEditGrid = effectiveIsFornitoreGridAdmin(me, activeOperator)
  return narrow && !canEditGrid
}
