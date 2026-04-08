'use client'

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center px-6 text-center">
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" className="w-24 h-24 mb-8">
        <defs>
          <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1e3a5f"/>
            <stop offset="100%" stopColor="#0f2a3f"/>
          </linearGradient>
          <linearGradient id="flow" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#3b82f6"/>
            <stop offset="100%" stopColor="#22d3ee"/>
          </linearGradient>
        </defs>
        <rect x="5" y="5" width="90" height="90" rx="22" fill="url(#bg)"/>
        <text x="50" y="52" textAnchor="middle"
          fontFamily="Arial, Helvetica, sans-serif" fontSize="20" fontWeight="700"
          fill="url(#flow)" letterSpacing="1">FLUXO</text>
        <path d="M20 65 C30 50, 50 50, 60 65 S80 80, 85 65"
          stroke="url(#flow)" strokeWidth="3.5" fill="none" strokeLinecap="round"/>
        <circle cx="20" cy="65" r="3" fill="#3b82f6"/>
        <circle cx="60" cy="65" r="3" fill="#22d3ee"/>
        <circle cx="85" cy="65" r="3" fill="#3b82f6"/>
      </svg>

      <h1 className="text-2xl font-bold text-white mb-2">Sei offline</h1>
      <p className="text-white/50 text-sm max-w-xs">
        Connettiti a internet per accedere a FLUXO. Le pagine già visitate sono disponibili offline.
      </p>

      <button
        onClick={() => window.location.reload()}
        className="mt-8 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl transition-colors"
      >
        Riprova
      </button>
    </div>
  )
}
