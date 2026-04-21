'use client'

import { useState, useCallback, useRef } from 'react'
import type { VatLookupResult } from '@/app/api/vat-lookup/route'

export type { VatLookupResult }

export function useVatLookup() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<VatLookupResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const lookup = useCallback((piva: string, country = 'IT') => {
    clearTimeout(debounceRef.current)
    const clean = piva.trim().replace(/\s/g, '').replace(/^IT/i, '').replace(/^GB/i, '')
    if (clean.length < 7) {
      setResult(null)
      setError(null)
      return
    }
    setLoading(true)
    setError(null)
    debounceRef.current = setTimeout(() => {
      fetch(`/api/vat-lookup?piva=${encodeURIComponent(clean)}&country=${country}`)
        .then((res) => (res.ok ? res.json() : Promise.reject(new Error('error'))))
        .then((data: VatLookupResult) => {
          setResult(data)
        })
        .catch(() => {
          setError('Lookup non disponibile')
        })
        .finally(() => {
          setLoading(false)
        })
    }, 600)
  }, [])

  const clear = useCallback(() => {
    clearTimeout(debounceRef.current)
    setResult(null)
    setError(null)
    setLoading(false)
  }, [])

  return { lookup, loading, result, error, clear }
}
