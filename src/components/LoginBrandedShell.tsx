import type { ReactNode } from 'react'

/** Sfondo full-screen con foto geometrica: stesso layout di `/login` e `/accesso`. */
export default function LoginBrandedShell({ children }: { children: ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-0 flex flex-col overflow-x-hidden overflow-y-auto overscroll-y-contain"
      style={{
        backgroundImage: "url('/background-geo.png')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
        backgroundRepeat: 'no-repeat',
        backgroundColor: '#0a192f',
      }}
    >
      {/* Overlay scuro per leggibilità testi */}
      <div className="pointer-events-none absolute inset-0 bg-[#0a192f]/55" />
      {/* Glow ciano in basso a destra */}
      <div className="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-cyan-500/8 blur-3xl" />
      <div className="relative z-10 mx-auto flex min-h-dvh w-[92%] max-w-md flex-1 flex-col items-center justify-center pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        {children}
      </div>
    </div>
  )
}
