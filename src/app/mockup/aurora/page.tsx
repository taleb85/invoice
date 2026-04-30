import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Mockup Aurora · anteprima',
  description:
    'Mockup visivo con Deep Aurora Intelligence Asset Guide: navy, royal blue, indaco, glass-card e neon chart.',
  robots: 'noindex, nofollow',
}

/** Deep Aurora Intelligence — Asset Guide + reference UI (aurora ribbon, neon charts) */
const DA = {
  navy: '#020617',
  royalBlue: '#1E40AF',
  indigo: '#3730A3',
  neonCyan: '#22d3ee',
  neonLime: '#a3e635',
  auroraPurple: '#7c3aed',
  auroraTeal: '#14b8a6',
  /** Tre linee grafico come sul reference promo */
  lineGreen: '#4ade80',
  lineYellow: '#facc15',
  lineBlue: '#38bdf8',
} as const

/** Sfondo fluido navy → viola → cyan dentro cornice telefono / viewport. */
function AuroraWallpaper({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit] ${className ?? ''}`}
    >
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(165deg, ${DA.navy} 0%, #0f172a 35%, #1e1b4b 55%, ${DA.navy} 100%)`,
        }}
      />
      {/* Fascia aurora */}
      <div className="absolute -left-[20%] top-[-10%] h-[58%] w-[140%] rotate-[-6deg] bg-gradient-to-r from-violet-600/55 via-indigo-500/35 via-40% to-cyan-500/30 blur-[46px]" />
      <div className="absolute -right-[30%] bottom-[-5%] h-[45%] w-[130%] rotate-[8deg] bg-gradient-to-l from-teal-500/40 via-purple-600/35 to-transparent blur-[50px]" />
      <div className="absolute left-[10%] top-[35%] h-[40%] w-[90%] rounded-full bg-[#06b6d4]/14 blur-[40px]" />
      <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white/[0.07] to-transparent" />
    </div>
  )
}

/** Pannello vetro: usa `.glass-card` definita in `globals.css` sotto `[data-deep-aurora-shell]`. */
function GlassPanel(props: { className?: string; children: React.ReactNode }) {
  return <div className={`glass-card ${props.className ?? ''}`}>{props.children}</div>
}

function FakeLineChart({ uid }: { uid: string }) {
  const f = `f-${uid}-blur`
  return (
    <svg viewBox="0 0 320 140" className="h-auto w-full" aria-hidden>
      <defs>
        <linearGradient id={`lg1-${uid}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={DA.lineGreen} stopOpacity="0.2" />
          <stop offset="100%" stopColor={DA.lineGreen} stopOpacity="0" />
        </linearGradient>
        <filter id={f} x="-50%" y="-40%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <path
        d="M16 112 L76 76 L136 94 L196 52 L256 62 L306 44"
        fill="none"
        stroke={DA.lineGreen}
        strokeWidth="2.75"
        strokeLinecap="round"
        filter={`url(#${f})`}
      />
      <path
        d="M16 112 L76 76 L136 94 L196 52 L256 62 L306 44 L306 130 L16 130 Z"
        fill={`url(#lg1-${uid})`}
      />
      <path
        d="M16 118 L76 98 L136 104 L196 82 L256 88 L306 74"
        fill="none"
        stroke={DA.lineYellow}
        strokeWidth="2.25"
        strokeLinecap="round"
        opacity={0.95}
      />
      <path
        d="M16 124 L76 108 L136 118 L196 94 L256 102 L306 94"
        fill="none"
        stroke={DA.lineBlue}
        strokeWidth="2.25"
        strokeLinecap="round"
        opacity={0.95}
      />
      {[16, 76, 136, 196, 256, 306].map((x, i) => (
        <circle key={i} cx={x} cy={110 - i * 8} r="2.5" fill="rgb(226 232 240 / 0.65)" />
      ))}
    </svg>
  )
}

function FakeBars({ uid }: { uid: string }) {
  const bars = [
    { h: 68, fill: DA.lineGreen },
    { h: 44, fill: DA.lineYellow },
    { h: 82, fill: DA.lineBlue },
    { h: 56, fill: DA.auroraPurple },
    { h: 72, fill: DA.neonCyan },
  ]
  return (
    <svg viewBox="0 0 120 140" className="h-auto w-[38%] shrink-0 min-w-[5rem]" aria-hidden>
      <defs>
        <filter id={`bar-glow-${uid}`} x="-40%" y="-20%" width="180%" height="140%">
          <feGaussianBlur stdDeviation="1.5" result="g" />
          <feMerge>
            <feMergeNode in="g" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {bars.map((b, i) => {
        const x = 14 + i * 20
        const y = 120 - b.h
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width="14"
            height={b.h}
            rx="3"
            fill={b.fill}
            opacity={0.92}
            filter={`url(#bar-glow-${uid})`}
          />
        )
      })}
    </svg>
  )
}

function FakeLineChartWide({ uid }: { uid: string }) {
  const f = `fw-${uid}-blur`
  return (
    <svg viewBox="0 0 560 148" className="h-36 min-h-[7rem] w-full sm:h-40" aria-hidden>
      <defs>
        <linearGradient id={`lg1w-${uid}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={DA.lineGreen} stopOpacity="0.18" />
          <stop offset="100%" stopColor={DA.lineGreen} stopOpacity="0" />
        </linearGradient>
        <filter id={f} x="-50%" y="-40%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <path
        d="M12 118 L112 74 L212 94 L312 52 L412 62 L548 42"
        fill="none"
        stroke={DA.lineGreen}
        strokeWidth="2.75"
        strokeLinecap="round"
        filter={`url(#${f})`}
      />
      <path d="M12 118 L112 74 L212 94 L312 52 L412 62 L548 42 L548 136 L12 136 Z" fill={`url(#lg1w-${uid})`} />
      <path
        d="M12 122 L112 98 L212 106 L312 82 L412 88 L548 74"
        fill="none"
        stroke={DA.lineYellow}
        strokeWidth={2}
        strokeLinecap="round"
        opacity={0.95}
      />
      <path
        d="M12 128 L112 112 L212 118 L312 94 L412 102 L548 94"
        fill="none"
        stroke={DA.lineBlue}
        strokeWidth={2}
        strokeLinecap="round"
        opacity={0.92}
      />
      {[12, 112, 212, 312, 412, 548].map((x, i) => (
        <circle key={i} cx={x} cy={118 - i * 6} r="2.75" fill="rgb(226 232 240 / 0.55)" />
      ))}
    </svg>
  )
}

function FakeBarsWide({ uid }: { uid: string }) {
  const bars = [
    { h: 74, fill: DA.lineGreen },
    { h: 46, fill: DA.lineYellow },
    { h: 88, fill: DA.lineBlue },
    { h: 52, fill: DA.auroraPurple },
    { h: 70, fill: DA.neonCyan },
    { h: 58, fill: DA.lineGreen },
    { h: 80, fill: DA.lineYellow },
  ]
  return (
    <svg viewBox="0 0 200 148" className="h-36 w-[22%] min-w-[8rem] shrink-0 sm:h-40" aria-hidden>
      <defs>
        <filter id={`barw-${uid}`} x="-35%" y="-15%" width="170%" height="130%">
          <feGaussianBlur stdDeviation="1.5" result="g" />
          <feMerge>
            <feMergeNode in="g" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {bars.map((b, i) => {
        const x = 10 + i * 25
        const y = 128 - b.h
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width="17"
            height={b.h}
            rx="4"
            fill={b.fill}
            opacity={0.9}
            filter={`url(#barw-${uid})`}
          />
        )
      })}
    </svg>
  )
}

const DESKTOP_KPIS = [
  {
    title: 'Ordini attivi',
    value: '24',
    sub: '+3 vs sett. scorsa',
    accent: 'text-[#93c5fd]',
    bar: 'from-[#1E40AF]/75 to-transparent',
  },
  {
    title: 'Bolle ricevute',
    value: '186',
    sub: 'mese corrente',
    accent: 'text-[#a3e635]',
    bar: 'from-[#a3e635]/90 to-transparent',
  },
  {
    title: 'Fatturato ricevuto',
    value: '€ 482k',
    sub: 'FY selezionata',
    accent: 'text-[#22d3ee]',
    bar: 'from-[#22d3ee]/80 to-transparent',
  },
  {
    title: 'Da revisionare',
    value: '7',
    sub: 'documenti in sospeso',
    accent: 'text-[#f87171]',
    bar: 'from-[#3730A3]/65 to-transparent',
  },
] as const

function BottomNavDockIconWrap({
  active,
  children,
}: {
  active: boolean
  children: React.ReactNode
}) {
  return (
    <span
      className={
        active
          ? 'text-[#38bdf8] [filter:drop-shadow(0_0_10px_rgba(56,189,248,.75))_drop-shadow(0_0_3px_rgba(56,189,248,.95))]'
          : 'text-[#cbd5e1]/75'
      }
    >
      {children}
    </span>
  )
}

function DeepAuroraDockTab({
  active,
  children,
  ariaLabel,
  placement = 'bottom',
}: {
  active?: boolean
  ariaLabel: string
  placement?: 'bottom' | 'left'
  children: React.ReactNode
}) {
  const isLeft = placement === 'left'
  const dim = isLeft
    ? 'relative flex h-[52px] w-full shrink-0 items-center justify-center rounded-xl outline-none transition-opacity focus-visible:ring-2 focus-visible:ring-[#38bdf8]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent'
    : 'relative flex min-h-[52px] min-w-0 flex-1 shrink flex-col items-center justify-center rounded-[1.25rem] pb-2.5 pt-3 outline-none transition-opacity focus-visible:ring-2 focus-visible:ring-[#38bdf8]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent'
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-current={active ? 'page' : undefined}
      className={`${dim} ${active ? '' : 'opacity-90 hover:opacity-100'}`}
    >
      <BottomNavDockIconWrap active={!!active}>{children}</BottomNavDockIconWrap>
      {active && !isLeft ? (
        <span
          aria-hidden
          className="pointer-events-none absolute bottom-2 left-1/2 h-[3.5px] w-7 -translate-x-1/2 rounded-[2px] bg-[#38bdf8]"
          style={{ boxShadow: '0 0 14px rgba(56,189,248,0.85), 0 0 6px rgba(56,189,248,1)' }}
        />
      ) : null}
      {active && isLeft ? (
        <span
          aria-hidden
          className="pointer-events-none absolute left-2 top-1/2 h-7 w-[3.5px] -translate-y-1/2 rounded-[2px] bg-[#38bdf8]"
          style={{ boxShadow: '0 0 14px rgba(56,189,248,0.85), 0 0 6px rgba(56,189,248,1)' }}
        />
      ) : null}
    </button>
  )
}

function BottomNav() {
  return (
    <nav
      aria-label="Navigazione inferiore (mock Deep Aurora)"
      className="mx-5 mb-[max(0.65rem,env(safe-area-inset-bottom))] flex shrink-0 items-center justify-evenly gap-1 border border-white/[0.12] bg-[rgba(15,23,42,0.42)] px-1 shadow-[0_12px_40px_-14px_rgba(0,0,0,.6),inset_0_1px_0_0_rgba(255,255,255,0.05)] backdrop-blur-[28px]"
      style={{ borderRadius: '1.875rem', WebkitBackdropFilter: 'blur(28px)' }}
    >
      <DeepAuroraDockTab active ariaLabel="Home">
        <HomeDockIcon className="h-[26px] w-[26px]" />
      </DeepAuroraDockTab>
      <DeepAuroraDockTab ariaLabel="Attività">
        <ActivityDockIcon className="h-[26px] w-[26px]" />
      </DeepAuroraDockTab>
      <DeepAuroraDockTab ariaLabel="Alert">
        <BellDockIcon className="h-[26px] w-[26px]" />
      </DeepAuroraDockTab>
      <DeepAuroraDockTab ariaLabel="Impostazioni">
        <GearDockIcon className="h-[26px] w-[26px]" />
      </DeepAuroraDockTab>
    </nav>
  )
}

function HomeDockIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.65}
      strokeLinejoin="round"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M4 11.5 12 4l8 7.5V20a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 20v-8.5z" />
      <path d="M9 21.5v-9h6v9" />
    </svg>
  )
}

function ActivityDockIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.65}
      strokeLinejoin="round"
      strokeLinecap="round"
      aria-hidden
    >
      <rect x="4.5" y="4.5" width="15" height="15" rx="4" ry="4" />
      <path d="m8 12.5 2.5 2 5-5.5" />
    </svg>
  )
}

function BellDockIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.65}
      strokeLinejoin="round"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0 1 18 14.158V11a6 6 0 1 0-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 1 1-6 0v-1m6 0H9" />
    </svg>
  )
}

function GearDockIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.65}
      strokeLinejoin="round"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 0 0-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 0 0-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 0 0-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 0 0-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 0 0 1.066-2.573c-.94-1.543.826-3.31 2.37-2.37a1.724 1.724 0 0 0 2.572-1.065z" />
      <path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z" />
    </svg>
  )
}

/** Stessa lingua visiva della bottom nav: vetro blur, glow solo su tab attiva, indicatore verticale a sinistra. */
function DesktopSidebarRail() {
  return (
    <nav
      aria-label="Navigazione principale workspace (mock Deep Aurora)"
      className="flex w-[76px] shrink-0 flex-col gap-1 border-r border-white/[0.12] bg-[rgba(15,23,42,0.42)] px-2 py-4 shadow-[inset_-1px_0_0_0_rgba(255,255,255,0.04)] backdrop-blur-[28px]"
      style={{ WebkitBackdropFilter: 'blur(28px)' }}
    >
      <DeepAuroraDockTab active ariaLabel="Home" placement="left">
        <HomeDockIcon className="h-[26px] w-[26px]" />
      </DeepAuroraDockTab>
      <DeepAuroraDockTab ariaLabel="Attività" placement="left">
        <ActivityDockIcon className="h-[26px] w-[26px]" />
      </DeepAuroraDockTab>
      <DeepAuroraDockTab ariaLabel="Alert" placement="left">
        <BellDockIcon className="h-[26px] w-[26px]" />
      </DeepAuroraDockTab>
      <DeepAuroraDockTab ariaLabel="Impostazioni" placement="left">
        <GearDockIcon className="h-[26px] w-[26px]" />
      </DeepAuroraDockTab>
    </nav>
  )
}

function DesktopWorkspaceMock() {
  return (
    <section aria-labelledby="mockup-desktop-title" className="mx-auto mb-16 max-w-[1280px]">
      <h2
        id="mockup-desktop-title"
        className="mb-4 text-center text-xs font-semibold uppercase tracking-[0.2em] text-white/90"
      >
        Versione desktop (workspace)
      </h2>
      <p className="mx-auto mb-6 max-w-2xl text-center text-sm text-white/70">
        Stesso set di icone della versione mobile, in colonna a sinistra: Home (attiva), Attività, Alert, Impostazioni.
        L’indicatore attivo è un segmento verticale sul bordo sinistro dell’icona (sotto la barra resta solo su mobile).
      </p>
      <div className="overflow-x-auto pb-4">
        <div className="mx-auto inline-block min-w-[min(1160px,100%)] lg:min-w-[1080px]">
          <div className="overflow-hidden rounded-2xl border border-cyan-400/40 bg-[#020617]/92 shadow-[0_8px_32px_rgba(0,0,0,.5),0_0_72px_-12px_rgba(34,211,238,.28)]">
            <div
              aria-hidden
              className="flex items-center gap-2 border-b border-white/10 bg-[#020617]/75 px-4 py-2.5 backdrop-blur-[20px]"
            >
              <span className="inline-flex gap-2">
                <span className="h-3 w-3 rounded-full bg-red-400/85" />
                <span className="h-3 w-3 rounded-full bg-amber-300/85" />
                <span className="h-3 w-3 rounded-full bg-emerald-400/80" />
              </span>
              <span className="ml-2 flex-1 rounded-md bg-white/[0.06] px-3 py-1 text-center text-[11px] text-white/70">
                app · mockup aurora desktop
              </span>
            </div>
            <div className="flex min-h-[560px]">
              <DesktopSidebarRail />
              <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                <header className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 bg-white/[0.04] px-4 py-4 backdrop-blur-md sm:px-6">
                  <div>
                    <h3 className="text-lg font-semibold text-white/90 sm:text-xl">Dashboard · Sede Nord demo</h3>
                    <p className="mt-1 text-sm text-white/70">FY 2026 · Eur · fuso CET</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-[12px] text-white/70 backdrop-blur-[20px]"
                      style={{ WebkitBackdropFilter: 'blur(20px)' }}
                    >
                      Cerca ovunque… ⌘K
                    </span>
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-[#3730A3]/40 text-sm font-semibold text-white/90">
                      TB
                    </span>
                  </div>
                </header>
                <div className="relative flex min-h-0 flex-1 flex-col">
                  <div className="pointer-events-none absolute inset-0 opacity-[0.42]">
                    <AuroraWallpaper />
                  </div>
                  <div className="relative z-[1] flex flex-1 flex-col gap-5 p-4 sm:p-6">
                    <GlassPanel className="p-5 sm:p-6">
                      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                        <span className="text-[13px] font-semibold uppercase tracking-wider text-white/90">
                          Andamento mensile
                        </span>
                        <div className="flex flex-wrap gap-2">
                          <span className="rounded-lg border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[11px] text-white/70">
                            Bolle vs fatture
                          </span>
                          <span className="rounded-lg border border-[#22d3ee]/35 bg-[#22d3ee]/10 px-2.5 py-1 text-[11px] text-[#67e8f9]">
                            Esporta (mockup)
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-row items-end gap-4">
                        <div className="min-w-0 flex-1">
                          <FakeLineChartWide uid="desk" />
                          <div className="mt-1 flex justify-between text-[11px] text-white/70">
                            {['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu'].map((m) => (
                              <span key={m}>{m}</span>
                            ))}
                          </div>
                        </div>
                        <FakeBarsWide uid="desk" />
                      </div>
                      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 border-t border-white/10 pt-4 text-[11px]">
                        <span className="flex items-center gap-2 text-[#4ade80]">
                          <span className="inline-block h-2 w-4 shrink-0 rounded-sm bg-[#4ade80]" />
                          <span>Trend risparmi (serie A)</span>
                        </span>
                        <span className="flex items-center gap-2 text-[#facc15]">
                          <span className="inline-block h-2 w-4 shrink-0 rounded-sm bg-[#facc15]" />
                          <span>Serie B</span>
                        </span>
                        <span className="flex items-center gap-2 text-[#38bdf8]">
                          <span className="inline-block h-2 w-4 shrink-0 rounded-sm bg-[#38bdf8]" />
                          <span>Serie C</span>
                        </span>
                      </div>
                    </GlassPanel>
                    <div className="grid gap-5 lg:grid-cols-12 lg:gap-6">
                      <div className="lg:col-span-8">
                        <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-white/90">
                          KPI operatore
                        </p>
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                          {DESKTOP_KPIS.map((k) => (
                            <GlassPanel key={k.title} className="relative overflow-hidden p-4">
                              <div
                                aria-hidden
                                className={`absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r ${k.bar}`}
                              />
                              <p className="text-[11px] font-medium text-white/90">{k.title}</p>
                              <p className={`mt-2 text-2xl font-semibold tracking-tight tabular-nums ${k.accent}`}>
                                {k.value}
                              </p>
                              <p className="mt-1.5 text-[12px] text-white/70">{k.sub}</p>
                            </GlassPanel>
                          ))}
                        </div>
                        <GlassPanel className="mt-5 p-5">
                          <p className="text-[13px] font-semibold uppercase tracking-wide text-white/90">
                            Fluxo scanner · score anomalie
                          </p>
                          <div className="mt-4 grid gap-4 sm:grid-cols-2">
                            <div>
                              <p className="text-[11px] text-white/70">Coda elaborata &lt; 24 h</p>
                              <p className="mt-1 text-3xl font-semibold tabular-nums text-white/90">78%</p>
                              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.08]">
                                <div
                                  className="h-full w-[78%] rounded-full"
                                  style={{
                                    backgroundImage: `linear-gradient(90deg, ${DA.neonCyan}, ${DA.neonLime})`,
                                  }}
                                />
                              </div>
                            </div>
                            <div className="flex flex-col justify-center rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
                              <p className="text-[11px] text-white/70">Risk score sintetico</p>
                              <p className="mt-2 text-xl font-semibold uppercase tracking-wide text-[#a3e635]">Basso</p>
                              <p className="mt-1 text-[12px] text-white/70">rekki · duplicati · listino</p>
                            </div>
                          </div>
                        </GlassPanel>
                      </div>
                      <div className="lg:col-span-4">
                        <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-white/90">
                          Priorità
                        </p>
                        <GlassPanel className="divide-y divide-white/10">
                          {[
                            { t: 'Gruppi duplicati', d: '2 possibili doppioni fatture' },
                            { t: 'Fornitori incompleti', d: 'P.IVA o SDI da completare' },
                            { t: 'Estratti in bilanciamento', d: '4 movimenti non abbinati' },
                            { t: 'Errori sync email', d: 'Vedere ultimo tentativo nel log' },
                          ].map((row) => (
                            <button
                              key={row.t}
                              type="button"
                              className="flex w-full items-start gap-3 px-4 py-3.5 text-left transition hover:bg-white/[0.06]"
                            >
                              <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#22d3ee]/30 bg-[#22d3ee]/10 text-[#e0f2fe]">
                                ◈
                              </span>
                              <div className="min-w-0">
                                <p className="text-[13px] font-medium leading-snug text-white/90">{row.t}</p>
                                <p className="mt-0.5 text-[12px] leading-snug text-white/70">{row.d}</p>
                              </div>
                            </button>
                          ))}
                        </GlassPanel>
                        <GlassPanel className="mt-4 p-4">
                          <p className="text-[11px] font-medium uppercase tracking-wide text-white/90">Suggerimento</p>
                          <p className="mt-2 text-[13px] leading-relaxed text-white/70">
                            Allinea i fornitori mancanti in coda Scanner prima del closing mensile — meno mismatch in
                            listino e nelle approvazioni.
                          </p>
                          <button
                            type="button"
                            className="mt-3 w-full rounded-xl border border-white/15 bg-white/10 px-3 py-2.5 text-left text-[12px] font-medium text-white/90 hover:bg-white/[0.12]"
                          >
                            Apri coda Scanner (mockup)
                          </button>
                        </GlassPanel>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function DeepAuroraFloatingTitle(props: { subtitle?: string }) {
  return (
    <div className="px-3 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))] text-center">
      <p className="text-[11px] font-semibold uppercase leading-tight tracking-[0.30em] text-white [text-shadow:0_0_18px_rgba(34,211,238,.4),0_0_40px_rgba(124,58,237,.25)] sm:text-[10px] sm:tracking-[0.26em]">
        Deep Aurora Intelligence
      </p>
      {props.subtitle ? <p className="mt-2 text-[11px] text-white/70">{props.subtitle}</p> : null}
    </div>
  )
}

function OppServerIcon() {
  return (
    <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={1.35} viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 11h14M8 7h8v4H8V7zm0 8h8v4H8v-4z" />
      <circle cx="8" cy="9" r="0.9" fill="currentColor" />
      <circle cx="8" cy="17" r="0.9" fill="currentColor" />
    </svg>
  )
}
function OppDocIcon() {
  return (
    <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={1.35} viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 3v4h4M7 21h10a2 2 0 002-2V9l-5-5H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      <path strokeLinecap="round" d="M9 17h6M9 13h6" />
    </svg>
  )
}
function OppKeyIcon() {
  return (
    <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={1.35} viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 13a4 4 0 01-8 0 4 4 0 018 0zM12 21l-2-2v-5M12 12l8-8 2 2-8 8" />
    </svg>
  )
}
function OppSparkIcon() {
  return (
    <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={1.35} viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 3L5 21l8-10-8 2 8-10z" />
    </svg>
  )
}

/** Riga compatta ispirata a «Top savings opportunities». */
function PhoneOpportunityStrip() {
  const cells = [
    { Icon: OppServerIcon, label: 'Alert server' },
    { Icon: OppDocIcon, label: 'Contratti' },
    { Icon: OppKeyIcon, label: 'Risparmi chiave' },
    { Icon: OppSparkIcon, label: 'Azioni smart' },
  ]
  return (
    <GlassPanel className="p-3">
      <p className="mb-3 text-center text-[10px] font-semibold uppercase tracking-[0.22em] text-white/90">
        Opportunità top
      </p>
      <div className="grid grid-cols-4 gap-2">
        {cells.map(({ Icon, label }) => (
          <div
            key={label}
            className="flex flex-col items-center gap-2 rounded-xl border border-cyan-400/30 bg-black/30 px-1 py-3 shadow-[inset_0_1px_0_0_rgba(255,255,255,.05),0_0_24px_-10px_rgba(34,211,238,.3)] backdrop-blur-sm"
          >
            <div className="flex h-[34px] w-[34px] items-center justify-center rounded-lg border border-cyan-300/35 bg-black/35 text-[#d2f9ff] shadow-[0_0_14px_-2px_rgba(34,211,238,.45)]">
              <Icon />
            </div>
            <span className="hyphens-auto text-center text-[7.5px] font-semibold uppercase leading-snug tracking-wide text-white/80">
              {label}
            </span>
          </div>
        ))}
      </div>
    </GlassPanel>
  )
}

function PhoneShell(props: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex w-full max-w-[360px] shrink-0 flex-col">
      <p className="mb-3 text-center text-xs font-medium tracking-wide text-white/70">{props.label}</p>
      <div
        className="relative flex max-h-[min(720px,calc(100vh-160px))] min-h-[560px] flex-col overflow-hidden rounded-[2.45rem] border border-cyan-400/45 shadow-[0_0_48px_-12px_rgba(34,211,238,.35),0_24px_80px_-20px_rgba(0,0,0,.85)]"
      >
        <AuroraWallpaper />
        <div className="relative z-[2] flex flex-1 flex-col overflow-y-auto">{props.children}</div>
      </div>
    </div>
  )
}

export default function MockupAuroraPage() {
  return (
    <div data-deep-aurora-shell className="app-background relative min-h-dvh">
      {/* Accento alto sottile sopra ai radial gradient */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 z-0 h-px bg-gradient-to-r from-transparent via-[var(--accent-color)]/50 to-transparent"
      />
      <div className="relative z-[1] mx-auto min-h-dvh w-full max-w-[1600px] flex-1 px-4 py-8 pb-16 font-[family-name:var(--font-outfit)] sm:px-6 lg:py-12">
        <GlassPanel className="mx-auto mb-10 max-w-3xl px-5 py-4 text-center sm:px-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#67e8f9]">
            Deep Aurora · Asset Guide
          </p>
          <h1 className="mt-1 text-lg font-semibold text-white/90 sm:text-xl">
            Dashboard Purchase Intelligence — mockup
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-white/70">
            Aggiornato per avvicinarsi al render promozionale: aurora fluida dentro ogni cornice telefono, vetro con bordo
            cyan luminoso, tre serie color (verde / giallo / blu) con glow, card opportunità a griglia come nel concept,
            barra inferiore con tratto brillante sulla tab attiva. URL:{' '}
            <code className="rounded-md border border-white/10 bg-black/35 px-1.5 py-0.5 text-[#67e8f9]">
              /mockup/aurora
            </code>
          </p>
        </GlassPanel>

        <DesktopWorkspaceMock />

        <h2 className="mx-auto mb-8 max-w-2xl text-center text-xs font-semibold uppercase tracking-[0.2em] text-white/90">
          Versione smartphone (cornici tipo device)
        </h2>

        <div className="flex flex-wrap items-start justify-center gap-10 xl:gap-14">
          <PhoneShell label="Schermata 1 · come il promo (grafici + KPI)">
            <DeepAuroraFloatingTitle subtitle="Insight mensili · demo" />
            <div className="flex-1 space-y-3 px-4 pb-2">
              <GlassPanel className="p-4">
                <div className="mb-1 flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/95">
                      Insight mensili
                    </span>
                    <p className="mt-1 text-[10px] text-white/70">Trend di risparmio</p>
                  </div>
                  <span className="shrink-0 rounded-lg border border-cyan-400/35 bg-black/35 px-2 py-1 text-[10px] font-medium text-[#93f8ff]/95">
                    Grafico ▾
                  </span>
                </div>
                <div className="mt-3 flex gap-2">
                  <div className="min-w-0 flex-1 pt-1">
                    <FakeLineChart uid="ph1-line" />
                    <div className="mt-2 flex justify-between text-[10px] text-white/70">
                      {['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu'].map((m) => (
                        <span key={m}>{m}</span>
                      ))}
                    </div>
                  </div>
                  <FakeBars uid="ph1-bar" />
                </div>
                <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 border-t border-white/10 pt-3 text-[9px]">
                  <span className="flex items-center gap-1.5 font-medium uppercase tracking-wide text-[#4ade80]">
                    <span className="inline-block h-1.5 w-3.5 shrink-0 rounded-sm bg-[#4ade80] shadow-[0_0_8px_#4ade80]" />{' '}
                    Serie verde
                  </span>
                  <span className="flex items-center gap-1.5 font-medium uppercase tracking-wide text-[#facc15]">
                    <span className="inline-block h-1.5 w-3.5 shrink-0 rounded-sm bg-[#facc15] shadow-[0_0_8px_rgba(250,204,21,.6)]" />{' '}
                    Serie giallo
                  </span>
                  <span className="flex items-center gap-1.5 font-medium uppercase tracking-wide text-[#38bdf8]">
                    <span className="inline-block h-1.5 w-3.5 shrink-0 rounded-sm bg-[#38bdf8] shadow-[0_0_8px_#38bdf8]" />{' '}
                    Serie blu
                  </span>
                </div>
              </GlassPanel>
              <div className="grid grid-cols-2 gap-2">
                <GlassPanel className="p-3">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-white/85">
                    Velocità acquisti
                  </p>
                  <p className="mt-2 text-2xl font-bold tabular-nums text-white/95 drop-shadow-[0_0_12px_rgba(255,255,255,.35)]">
                    78%
                  </p>
                  <p className="mt-1 text-[10px] text-white/70">vs obiettivo FY</p>
                </GlassPanel>
                <GlassPanel className="p-3">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-white/85">Risk score</p>
                  <p className="mt-2 text-xl font-bold uppercase tracking-wide text-[#4ade80] drop-shadow-[0_0_14px_rgba(74,222,128,.75)]">
                    Low
                  </p>
                  <p className="mt-1 text-[10px] text-white/70">portfolio sicuro</p>
                </GlassPanel>
              </div>
            </div>
            <BottomNav />
          </PhoneShell>

          <PhoneShell label="Schermata 2 · KPI in vetro affiancati">
            <DeepAuroraFloatingTitle />
            <p className="px-4 pb-1 text-center text-xs font-semibold text-white/90">Riepilogo operativo</p>
            <div className="flex-1 space-y-2.5 px-4 pb-2">
              {DESKTOP_KPIS.map((k) => (
                <GlassPanel key={k.title} className="relative overflow-hidden p-3.5">
                  <div
                    aria-hidden
                    className={`absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r ${k.bar} opacity-80`}
                  />
                  <div className="relative flex justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-medium text-white/90">{k.title}</p>
                      <p className={`mt-1 text-2xl font-semibold tabular-nums ${k.accent}`}>{k.value}</p>
                      <p className="mt-1 text-[11px] text-white/70">{k.sub}</p>
                    </div>
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05]">
                      <span className={`text-lg font-light ${k.accent}`}>→</span>
                    </div>
                  </div>
                </GlassPanel>
              ))}
            </div>
            <BottomNav />
          </PhoneShell>

          <PhoneShell label="Schermata 3 · striscia opportunità (reference)">
            <DeepAuroraFloatingTitle subtitle="Purchase intelligence" />
            <div className="flex flex-1 flex-col gap-3 px-4 pb-2 pt-2">
              <PhoneOpportunityStrip />
              <GlassPanel className="p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/90">Azioni consigliate</p>
                <p className="mt-3 text-[12px] leading-relaxed text-white/70">
                  Verifica prima i contratti vendor in scadenza e allinea gli alert sicurezza: massimo impatto sul
                  benchmark di risparmio.
                </p>
                <button
                  type="button"
                  className="mt-4 w-full rounded-xl border border-cyan-400/40 bg-[#22d3ee]/15 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wide text-[#b6faff] shadow-[0_0_22px_-6px_rgba(34,211,238,.6)] backdrop-blur-sm"
                  style={{ WebkitBackdropFilter: 'blur(12px)' }}
                >
                  Apri workflow demo
                </button>
              </GlassPanel>
            </div>
            <BottomNav />
          </PhoneShell>
        </div>
      </div>
    </div>
  )
}
