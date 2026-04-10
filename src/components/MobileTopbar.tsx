'use client'

interface MobileTopbarProps {
  onOpen: () => void
}

export default function MobileTopbar({ onOpen }: MobileTopbarProps) {
  return (
    <div className="md:hidden fixed top-0 left-0 right-0 z-30 h-14 bg-[#1a3050] flex items-center gap-2 px-3 border-b border-white/10 shrink-0">
      <button
        onClick={onOpen}
        className="p-2.5 -ml-1.5 text-white/70 hover:text-white hover:bg-white/10 active:bg-white/20 rounded-xl transition-colors touch-manipulation"
        aria-label="Apri menu"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16"/>
        </svg>
      </button>

      <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => window.location.reload()}>
        <svg viewBox="0 0 100 60" xmlns="http://www.w3.org/2000/svg" className="w-12 h-8 shrink-0">
          <defs>
            <linearGradient id="tb-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#3b82f6"/>
              <stop offset="100%" stopColor="#22d3ee"/>
            </linearGradient>
          </defs>
          <rect x="0" y="5" width="50" height="50" rx="12" fill="url(#tb-grad)" opacity="0.2"/>
          <path d="M5 35 C20 15, 45 15, 55 35 S80 55, 95 35"
                stroke="url(#tb-grad)" strokeWidth="4" fill="none" strokeLinecap="round"/>
          <circle cx="5"  cy="35" r="4" fill="#3b82f6"/>
          <circle cx="55" cy="35" r="4" fill="#22d3ee"/>
          <circle cx="95" cy="35" r="4" fill="#3b82f6"/>
        </svg>
        <div className="flex flex-col gap-0.5 leading-none">
          <span className="text-base font-extrabold tracking-widest bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">
            FLUXO
          </span>
          <span className="text-[10px] text-white/80 tracking-wide">Gestione Fatture</span>
        </div>
      </div>
    </div>
  )
}
