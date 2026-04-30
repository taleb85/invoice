import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Mockup Aurora · anteprima',
  description:
    'Solo prototipo visivo locale: glassmorphism, palette aurora e struttura ispirate alla dashboard reale.',
  robots: 'noindex, nofollow',
}

function AuroraBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[#050816]" />
      <div className="absolute -top-40 -left-24 h-[480px] w-[480px] rounded-full bg-violet-600/35 blur-[100px]" />
      <div className="absolute top-32 -right-20 h-[420px] w-[420px] rounded-full bg-cyan-500/25 blur-[90px]" />
      <div className="absolute bottom-0 left-1/3 h-[360px] w-[560px] -translate-x-1/2 rounded-full bg-emerald-500/20 blur-[100px]" />
      <div className="absolute bottom-[-20%] right-[-10%] h-[400px] w-[400px] rounded-full bg-indigo-700/40 blur-[110px]" />
    </div>
  )
}

function GlassPanel(props: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={`rounded-2xl border border-white/[0.14] bg-white/[0.05] shadow-[0_24px_64px_-12px_rgba(0,0,0,0.55)] backdrop-blur-2xl ${props.className ?? ''}`}
    >
      {props.children}
    </div>
  )
}

function FakeLineChart() {
  return (
    <svg viewBox="0 0 320 140" className="h-auto w-full" aria-hidden>
      <defs>
        <linearGradient id="lg1" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="rgb(52 211 153)" stopOpacity="0.25" />
          <stop offset="100%" stopColor="rgb(52 211 153)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d="M16 112 L76 76 L136 94 L196 52 L256 62 L306 44"
        fill="none"
        stroke="rgb(52 211 153)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M16 112 L76 76 L136 94 L196 52 L256 62 L306 44 L306 130 L16 130 Z"
        fill="url(#lg1)"
      />
      <path
        d="M16 118 L76 98 L136 104 L196 82 L256 88 L306 74"
        fill="none"
        stroke="rgb(250 204 21)"
        strokeWidth="2"
        strokeLinecap="round"
        opacity={0.9}
      />
      <path
        d="M16 124 L76 108 L136 118 L196 94 L256 102 L306 94"
        fill="none"
        stroke="rgb(56 189 248)"
        strokeWidth="2"
        strokeLinecap="round"
        opacity={0.85}
      />
      {[16, 76, 136, 196, 256, 306].map((x, i) => (
        <circle key={i} cx={x} cy={110 - i * 8} r="3" fill="rgb(226 232 240 / 0.7)" />
      ))}
    </svg>
  )
}

function FakeBars() {
  const bars = [
    { h: 68, fill: 'rgb(52 211 153)' },
    { h: 44, fill: 'rgb(250 204 21)' },
    { h: 82, fill: 'rgb(56 189 248)' },
    { h: 56, fill: 'rgb(167 139 250)' },
    { h: 72, fill: 'rgb(52 211 153)' },
  ]
  return (
    <svg viewBox="0 0 120 140" className="h-auto w-[38%] shrink-0 min-w-[5rem]" aria-hidden>
      {bars.map((b, i) => {
        const x = 14 + i * 20
        const y = 120 - b.h
        return <rect key={i} x={x} y={y} width="14" height={b.h} rx="3" fill={b.fill} opacity={0.9} />
      })}
    </svg>
  )
}

function FakeLineChartWide() {
  return (
    <svg viewBox="0 0 560 148" className="h-36 min-h-[7rem] w-full sm:h-40" aria-hidden>
      <defs>
        <linearGradient id="lg1w" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="rgb(52 211 153)" stopOpacity="0.22" />
          <stop offset="100%" stopColor="rgb(52 211 153)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d="M12 118 L112 74 L212 94 L312 52 L412 62 L548 42"
        fill="none"
        stroke="rgb(52 211 153)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path d="M12 118 L112 74 L212 94 L312 52 L412 62 L548 42 L548 136 L12 136 Z" fill="url(#lg1w)" />
      <path
        d="M12 122 L112 98 L212 106 L312 82 L412 88 L548 74"
        fill="none"
        stroke="rgb(250 204 21)"
        strokeWidth={2}
        strokeLinecap="round"
        opacity={0.9}
      />
      <path
        d="M12 128 L112 112 L212 118 L312 94 L412 102 L548 94"
        fill="none"
        stroke="rgb(56 189 248)"
        strokeWidth={2}
        strokeLinecap="round"
        opacity={0.85}
      />
      {[12, 112, 212, 312, 412, 548].map((x, i) => (
        <circle key={i} cx={x} cy={118 - i * 6} r="3" fill="rgb(226 232 240 / 0.65)" />
      ))}
    </svg>
  )
}

function FakeBarsWide() {
  const bars = [
    { h: 74, fill: 'rgb(52 211 153)' },
    { h: 46, fill: 'rgb(250 204 21)' },
    { h: 88, fill: 'rgb(56 189 248)' },
    { h: 52, fill: 'rgb(167 139 250)' },
    { h: 70, fill: 'rgb(52 211 153)' },
    { h: 58, fill: 'rgb(250 204 21)' },
    { h: 80, fill: 'rgb(56 189 248)' },
  ]
  return (
    <svg viewBox="0 0 200 148" className="h-36 w-[22%] min-w-[8rem] shrink-0 sm:h-40" aria-hidden>
      {bars.map((b, i) => {
        const x = 10 + i * 25
        const y = 128 - b.h
        return <rect key={i} x={x} y={y} width="17" height={b.h} rx="4" fill={b.fill} opacity={0.9} />
      })}
    </svg>
  )
}

const DESKTOP_KPIS = [
  {
    title: 'Ordini attivi',
    value: '24',
    sub: '+3 vs sett. scorsa',
    accent: 'text-violet-300',
    bar: 'from-violet-500/70 to-transparent',
  },
  {
    title: 'Bolle ricevute',
    value: '186',
    sub: 'mese corrente',
    accent: 'text-emerald-300',
    bar: 'from-emerald-500/70 to-transparent',
  },
  {
    title: 'Fatturato ricevuto',
    value: '€ 482k',
    sub: 'FY selezionata',
    accent: 'text-amber-300',
    bar: 'from-amber-500/65 to-transparent',
  },
  {
    title: 'Da revisionare',
    value: '7',
    sub: 'documenti in sospeso',
    accent: 'text-red-300',
    bar: 'from-red-500/60 to-transparent',
  },
] as const

const DESKTOP_SIDEBAR = [
  ['Dashboard', true],
  ['Ordini', false],
  ['Fatture & bolle', false],
  ['Fornitori', false],
  ['Scanner AI', false],
  ['Archivio', false],
  ['Impostazioni', false],
] as const

function DesktopWorkspaceMock() {
  return (
    <section aria-labelledby="mockup-desktop-title" className="mx-auto mb-16 max-w-[1280px]">
      <h2
        id="mockup-desktop-title"
        className="mb-4 text-center text-xs font-semibold uppercase tracking-[0.2em] text-white/55"
      >
        Versione desktop (workspace)
      </h2>
      <p className="mx-auto mb-6 max-w-2xl text-center text-sm text-white/60">
        Layout tipo app su viewport grandi: colonna navigazione + dashboard con grafico espanso e griglia KPI. Su schermo
        stretto la cornice può essere scrollata in orizzontale.
      </p>
      <div className="overflow-x-auto pb-4">
        <div className="mx-auto inline-block min-w-[min(1160px,100%)] lg:min-w-[1080px]">
          <div className="overflow-hidden rounded-2xl border border-white/22 bg-black/40 shadow-[0_32px_120px_-24px_rgba(0,0,0,0.85)]">
            <div
              aria-hidden
              className="flex items-center gap-2 border-b border-white/12 bg-black/55 px-4 py-2.5 backdrop-blur-md"
            >
              <span className="inline-flex gap-2">
                <span className="h-3 w-3 rounded-full bg-red-400/85" />
                <span className="h-3 w-3 rounded-full bg-amber-300/85" />
                <span className="h-3 w-3 rounded-full bg-emerald-400/80" />
              </span>
              <span className="ml-2 flex-1 rounded-md bg-white/[0.07] px-3 py-1 text-center text-[11px] text-white/40">
                app · mockup aurora desktop
              </span>
            </div>
            <div className="flex min-h-[560px]">
              <aside className="hidden w-[220px] shrink-0 flex-col border-r border-white/10 bg-white/[0.03] backdrop-blur-xl sm:flex">
                <div className="border-b border-white/[0.08] px-5 py-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/85">Smart Pair</p>
                  <p className="mt-1 text-[11px] text-white/40">Intelligence · demo</p>
                </div>
                <nav className="flex flex-1 flex-col gap-0.5 p-3">
                  {DESKTOP_SIDEBAR.map(([label, active]) => (
                    <div
                      key={label}
                      className={`rounded-xl px-3 py-2.5 text-[13px] font-medium ${active ? 'border border-cyan-400/35 bg-cyan-500/15 text-cyan-100' : 'cursor-default text-white/50 hover:bg-white/[0.05]'}`}
                    >
                      {label}
                    </div>
                  ))}
                </nav>
              </aside>
              <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                <header className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 bg-white/[0.04] px-4 py-4 backdrop-blur-md sm:px-6">
                  <div>
                    <h3 className="text-lg font-semibold text-white sm:text-xl">Dashboard · Sede Nord demo</h3>
                    <p className="mt-1 text-sm text-white/50">FY 2026 · Eur · fuso CET</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-[12px] text-white/70">
                      Cerca ovunque… ⌘K
                    </span>
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/15 bg-violet-500/25 text-sm font-semibold text-white/90">
                      TB
                    </span>
                  </div>
                </header>
                <div className="flex flex-1 flex-col gap-5 p-4 sm:p-6">
                  <GlassPanel className="p-5 sm:p-6">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <span className="text-[13px] font-semibold uppercase tracking-wider text-white/90">
                        Andamento mensile
                      </span>
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] text-white/55">
                          Bolle vs fatture
                        </span>
                        <span className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] text-emerald-200/95">
                          Esporta (mockup)
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-row items-end gap-4">
                      <div className="min-w-0 flex-1">
                        <FakeLineChartWide />
                        <div className="mt-1 flex justify-between text-[11px] text-white/42">
                          {['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu'].map((m) => (
                            <span key={m}>{m}</span>
                          ))}
                        </div>
                      </div>
                      <FakeBarsWide />
                    </div>
                    <div className="mt-4 flex flex-wrap gap-4 border-t border-white/10 pt-4 text-[11px]">
                      <span className="flex items-center gap-1.5 text-emerald-300/90">
                        <span className="inline-block h-2 w-4 rounded-sm bg-emerald-400" /> Bolle in ingresso
                      </span>
                      <span className="flex items-center gap-1.5 text-amber-200/90">
                        <span className="inline-block h-2 w-4 rounded-sm bg-amber-300" /> Fatture registrate
                      </span>
                      <span className="flex items-center gap-1.5 text-sky-300/90">
                        <span className="inline-block h-2 w-4 rounded-sm bg-sky-400" /> Importi cumulativi
                      </span>
                    </div>
                  </GlassPanel>
                  <div className="grid gap-5 lg:grid-cols-12 lg:gap-6">
                    <div className="lg:col-span-8">
                      <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-white/45">KPI operatore</p>
                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        {DESKTOP_KPIS.map((k) => (
                          <GlassPanel key={k.title} className="relative overflow-hidden p-4">
                            <div
                              aria-hidden
                              className={`absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r ${k.bar}`}
                            />
                            <p className="text-[11px] font-medium text-white/52">{k.title}</p>
                            <p className={`mt-2 text-2xl font-semibold tracking-tight tabular-nums ${k.accent}`}>
                              {k.value}
                            </p>
                            <p className="mt-1.5 text-[12px] text-white/40">{k.sub}</p>
                          </GlassPanel>
                        ))}
                      </div>
                      <GlassPanel className="mt-5 p-5">
                        <p className="text-[13px] font-semibold uppercase tracking-wide text-white/55">
                          Fluxo scanner · score anomalie
                        </p>
                        <div className="mt-4 grid gap-4 sm:grid-cols-2">
                          <div>
                            <p className="text-[11px] text-white/45">Coda elaborata &lt; 24 h</p>
                            <p className="mt-1 text-3xl font-semibold tabular-nums text-white">78%</p>
                            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.08]">
                              <div className="h-full w-[78%] rounded-full bg-gradient-to-r from-emerald-500 to-emerald-300/85" />
                            </div>
                          </div>
                          <div className="flex flex-col justify-center rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
                            <p className="text-[11px] text-white/45">Risk score sintetico</p>
                            <p className="mt-2 text-xl font-semibold uppercase tracking-wide text-emerald-400">Basso</p>
                            <p className="mt-1 text-[12px] text-white/40">rekki · duplicati · listino</p>
                          </div>
                        </div>
                      </GlassPanel>
                    </div>
                    <div className="lg:col-span-4">
                      <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-white/45">
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
                            <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-500/25 bg-cyan-500/10 text-cyan-200/85">
                              ◈
                            </span>
                            <div className="min-w-0">
                              <p className="text-[13px] font-medium leading-snug text-white">{row.t}</p>
                              <p className="mt-0.5 text-[12px] leading-snug text-white/47">{row.d}</p>
                            </div>
                          </button>
                        ))}
                      </GlassPanel>
                      <GlassPanel className="mt-4 p-4">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-white/50">Suggerimento</p>
                        <p className="mt-2 text-[13px] leading-relaxed text-white/82">
                          Allinea i fornitori mancanti in coda Scanner prima del closing mensile — meno mismatch in listino
                          e nelle approvazioni.
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
    </section>
  )
}

function BottomNav() {
  const item =
    'flex flex-1 flex-col items-center gap-1 py-2 text-[10px] font-medium tracking-wide uppercase text-white/45'
  const active = `${item.replace('text-white/45', '')} text-cyan-300`
  return (
    <GlassPanel className="mx-3 mb-4 flex shrink-0 items-stretch px-2">
      <div className={active}>
        <HomeIcon />
        Home
      </div>
      <div className={item}>
        <DocIcon />
        Doc.
      </div>
      <div className={item}>
        <BellIcon />
        Avvisi
      </div>
      <div className={item}>
        <GearIcon />
        Altro
      </div>
    </GlassPanel>
  )
}

function HomeIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  )
}
function DocIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  )
}
function BellIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  )
}
function GearIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

function PhoneShell(props: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex w-full max-w-[360px] shrink-0 flex-col">
      <p className="mb-3 text-center text-xs font-medium tracking-wide text-white/55">{props.label}</p>
      <div className="flex max-h-[min(720px,calc(100vh-160px))] min-h-[560px] flex-col overflow-hidden rounded-[2.35rem] border border-white/20 bg-black/35 shadow-[0_40px_100px_-20px_rgba(0,0,0,0.75)]">
        <div className="relative z-[1] flex flex-1 flex-col overflow-y-auto">{props.children}</div>
      </div>
    </div>
  )
}

export default function MockupAuroraPage() {
  return (
    <>
      <AuroraBackdrop />
      <div className="relative z-[1] mx-auto min-h-dvh max-w-[1600px] px-4 py-8 pb-16 font-[family-name:var(--font-outfit)] sm:px-6 lg:py-12">
        <GlassPanel className="mx-auto mb-10 max-w-3xl px-5 py-4 text-center sm:px-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-200/90">Anteprima design</p>
          <h1 className="mt-1 text-lg font-semibold text-white sm:text-xl">
            Dashboard in stile «Aurora / glass»
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-white/70">
            Solo mockup visivo — dati inventati — per confrontare tono e gerarchia su desktop e smartphone con
            Smart Pair / Fluxo. Apri mentre il dev server è in esecuzione:{' '}
            <code className="rounded bg-black/35 px-1.5 py-0.5 text-cyan-200/95">/mockup/aurora</code>
          </p>
        </GlassPanel>

        <DesktopWorkspaceMock />

        <h2 className="mx-auto mb-8 max-w-2xl text-center text-xs font-semibold uppercase tracking-[0.2em] text-white/55">
          Versione smartphone (cornici tipo device)
        </h2>

        <div className="flex flex-wrap items-start justify-center gap-10 xl:gap-14">
          <PhoneShell label="Schermata 1 · insight e trend">
            <div className="px-4 pb-3 pt-[max(0.875rem,env(safe-area-inset-top))]">
              <p className="text-center text-[10px] font-semibold uppercase tracking-[0.28em] text-white/80">
                Smart Pair Intelligence
              </p>
              <p className="mt-3 text-xs text-white/50">Sede · Nord demo</p>
            </div>
            <div className="flex-1 space-y-3 px-4 pb-2">
              <GlassPanel className="p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-white/90">
                    Andamento mensile
                  </span>
                  <span className="rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-[11px] text-white/60">
                  Periodo FY ▾
                </span>
                </div>
                <div className="flex gap-2">
                  <div className="min-w-0 flex-1 pt-2">
                    <FakeLineChart />
                    <div className="mt-2 flex justify-between text-[10px] text-white/40">
                      {['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu'].map((m) => (
                        <span key={m}>{m}</span>
                      ))}
                    </div>
                  </div>
                  <FakeBars />
                </div>
                <div className="mt-4 flex gap-3 text-[10px]">
                  <span className="flex items-center gap-1 text-emerald-300/90">
                    <span className="inline-block h-1.5 w-3 rounded-sm bg-emerald-400" /> Bolle
                  </span>
                  <span className="flex items-center gap-1 text-amber-200/90">
                    <span className="inline-block h-1.5 w-3 rounded-sm bg-amber-300" /> Fatture
                  </span>
                  <span className="flex items-center gap-1 text-sky-300/90">
                    <span className="inline-block h-1.5 w-3 rounded-sm bg-sky-400" /> Importi
                  </span>
                </div>
              </GlassPanel>
              <div className="grid grid-cols-2 gap-2">
                <GlassPanel className="p-3">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-white/50">Fluxo scanner</p>
                  <p className="mt-2 text-2xl font-semibold tabular-nums text-white">78%</p>
                  <p className="mt-1 text-[11px] text-emerald-300/90">in coda elaborati &lt; 24h</p>
                </GlassPanel>
                <GlassPanel className="p-3">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-white/50">
                    Score anomalie
                  </p>
                  <p className="mt-2 text-xl font-semibold uppercase tracking-wide text-emerald-400">Basso</p>
                  <p className="mt-1 text-[11px] text-white/45">rekki · duplicati</p>
                </GlassPanel>
              </div>
            </div>
            <BottomNav />
          </PhoneShell>

          <PhoneShell label="Schermata 2 · KPI stile tessere">
            <div className="px-4 pb-3 pt-[max(0.875rem,env(safe-area-inset-top))]">
              <p className="text-center text-[10px] font-semibold uppercase tracking-[0.28em] text-white/80">
                Smart Pair Intelligence
              </p>
              <p className="mt-4 text-xs font-semibold text-white">Riepilogo operatore</p>
            </div>
            <div className="flex-1 space-y-2.5 px-4 pb-2">
              {DESKTOP_KPIS.map((k) => (
                <GlassPanel key={k.title} className="relative overflow-hidden p-3.5">
                  <div
                    aria-hidden
                    className={`absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r ${k.bar} opacity-80`}
                  />
                  <div className="relative flex justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-medium text-white/55">{k.title}</p>
                      <p className={`mt-1 text-2xl font-semibold tabular-nums ${k.accent}`}>{k.value}</p>
                      <p className="mt-1 text-[11px] text-white/40">{k.sub}</p>
                    </div>
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5">
                      <span className={`text-lg font-light ${k.accent}`}>→</span>
                    </div>
                  </div>
                </GlassPanel>
              ))}
            </div>
            <BottomNav />
          </PhoneShell>

          <PhoneShell label="Schermata 3 · priorità e azioni">
            <div className="px-4 pb-3 pt-[max(0.875rem,env(safe-area-inset-top))]">
              <p className="text-center text-[10px] font-semibold uppercase tracking-[0.28em] text-white/80">
                Smart Pair Intelligence
              </p>
              <p className="mt-4 text-xs font-semibold text-white">Cose da fare adesso</p>
            </div>
            <div className="flex-1 px-4 pb-2">
              <GlassPanel className="divide-y divide-white/10">
                {[
                  { t: 'Gruppi duplicati', d: '2 possibili doppioni fatture', icon: '◇' },
                  { t: 'Fornitori incompleti', d: 'P.IVA o SDI da completare', icon: '◇' },
                  { t: 'Estratti in bilanciamento', d: '4 movimenti non abbinati', icon: '◇' },
                  { t: 'Errori sincronizzazione log', d: 'Ultimo sync email · vedere log', icon: '◇' },
                ].map((row) => (
                  <button
                    key={row.t}
                    type="button"
                    className="flex w-full items-start gap-3 px-4 py-3.5 text-left transition hover:bg-white/[0.06]"
                  >
                    <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-500/25 bg-cyan-500/10 text-cyan-200/90">
                      {row.icon}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white">{row.t}</p>
                      <p className="mt-0.5 text-[12px] text-white/50">{row.d}</p>
                    </div>
                  </button>
                ))}
              </GlassPanel>
              <GlassPanel className="mt-3 p-4">
                <p className="text-[11px] font-medium uppercase tracking-wide text-white/50">azione consigliata</p>
                <p className="mt-2 text-sm leading-snug text-white/85">
                  Apri la coda Scanner e associa il fornitore mancante sui PDF in attesa — riduce il rischio mismatch
                  in listino.
                </p>
                <span className="mt-3 inline-flex rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-medium text-white/90">
                  Vai allo scanner (mockup)
                </span>
              </GlassPanel>
            </div>
            <BottomNav />
          </PhoneShell>
        </div>
      </div>
    </>
  )
}
