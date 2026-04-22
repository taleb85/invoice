'use client'
import { useEffect, useState } from 'react'

interface SplashScreenProps {
  message?: string
}

export function SplashScreen({ message }: SplashScreenProps) {
  const [dots, setDots] = useState('')

  useEffect(() => {
    const interval = setInterval(() => {
      setDots(d => d.length >= 3 ? '' : d + '.')
    }, 400)
    return () => clearInterval(interval)
  }, [])

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#0a192f]"
      style={{
        backgroundImage: "url('/background-geo.png')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="pointer-events-none absolute inset-0 bg-[#0a192f]/60" />
      <div className="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-cyan-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full bg-indigo-500/10 blur-3xl" />

      <div className="relative z-10 flex flex-col items-center gap-8">

        {/* Logo */}
        <div className="relative">
          <div className="absolute inset-0 animate-ping rounded-2xl bg-[#22d3ee]/20" />
          <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-[#0f2a4a] ring-1 ring-[#22d3ee]/30 shadow-[0_0_40px_rgba(34,211,238,0.2)]">
            <svg width="56" height="56" viewBox="0 0 64 64" fill="none" aria-hidden>
              <path
                d="M8 32 L22 18 L22 26 L42 26 L42 32"
                stroke="#22d3ee" strokeWidth="5"
                strokeLinejoin="round" strokeLinecap="round"
              />
              <path
                d="M56 32 L42 46 L42 38 L22 38 L22 32"
                stroke="#5b7cf9" strokeWidth="5"
                strokeLinejoin="round" strokeLinecap="round"
              />
            </svg>
          </div>
        </div>

        {/* Wordmark */}
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-baseline gap-2">
            <span className="font-outfit text-3xl font-medium text-[#22d3ee]">Smart</span>
            <span className="font-outfit text-3xl font-light text-white/85">Pair</span>
          </div>
          <span className="text-[10px] uppercase tracking-[3px] text-[#22d3ee]/40">
            Invoice Management
          </span>
        </div>

        {/* Loading indicator */}
        <div className="flex flex-col items-center gap-3">
          <div className="flex gap-1.5">
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className="h-1.5 w-1.5 rounded-full bg-[#22d3ee]"
                style={{ animation: `sp-bounce 1.2s ease-in-out ${i * 0.2}s infinite` }}
              />
            ))}
          </div>
          <p className="min-w-[180px] text-center text-sm text-white/40">
            {message ?? `Caricamento${dots}`}
          </p>
        </div>
      </div>

      <style>{`
        @keyframes sp-bounce {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
