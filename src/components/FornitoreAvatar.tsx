'use client'

import { useEffect, useState } from 'react'

/**
 * Avatar scheda fornitore: `logo_url` se caricabile, altrimenti iniziali del nome.
 */
export default function FornitoreAvatar({
  nome,
  logoUrl,
  sizeClass = 'h-10 w-10',
  className = '',
}: {
  nome: string
  logoUrl?: string | null
  sizeClass?: string
  className?: string
}) {
  const initials =
    nome
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase() || '?'

  const trimmed = logoUrl?.trim() ?? ''
  const [imgOk, setImgOk] = useState(true)

  useEffect(() => {
    setImgOk(true)
  }, [trimmed])

  const showImg = Boolean(trimmed && imgOk)

  return (
    <div
      className={`${sizeClass} relative flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-app-cyan-500 to-blue-600 text-sm font-bold text-white ${className}`}
      aria-hidden={showImg}
    >
      {showImg ? (
        // eslint-disable-next-line @next/next/no-img-element -- URL arbitrari (fornitori); next/image richiederebbe allowlist ampia
        <img
          src={trimmed}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          onError={() => setImgOk(false)}
          referrerPolicy="no-referrer"
        />
      ) : (
        initials
      )}
    </div>
  )
}
