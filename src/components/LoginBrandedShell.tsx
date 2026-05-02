import type { ReactNode } from 'react'

/** Sfondo full-screen Deep Aurora: allineato a dashboard/mock (`globals.css`). Usato da `/login`, `/accesso`, ecc. */
export default function LoginBrandedShell({ children }: { children: ReactNode }) {
  return (
    <div
      data-deep-aurora-public-shell
      className="fixed inset-0 z-0 flex h-dvh min-h-0 flex-col overflow-hidden bg-transparent"
    >
      {/*
        Layer fisso sul viewport: se era nello stesso elemento scrollabile, scorrendo spariva
        e compariva il gradiente body (cucitura a due colori).
      */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0">
        <div className="pointer-events-none absolute inset-x-0 top-0 min-h-[120%] bg-[radial-gradient(ellipse_72%_48%_at_50%_-8%,rgb(56_189_248/0.2),transparent_58%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_110%_85%_at_50%_42%,transparent_32%,rgb(2_6_23/0.48)_93%)] sm:bg-[radial-gradient(ellipse_95%_80%_at_50%_46%,transparent_38%,rgb(2_6_23/0.52)_96%)]" />
        <div className="pointer-events-none absolute -bottom-36 -right-28 h-[22rem] w-[22rem] rounded-full bg-sky-400/[0.18] blur-[100px]" />
        <div className="pointer-events-none absolute bottom-12 -left-20 h-[18rem] w-[18rem] rounded-full bg-indigo-500/[0.22] blur-[88px]" />
      </div>

      <div className="relative z-10 flex min-h-0 w-full flex-1 flex-col overflow-x-hidden overflow-y-auto overscroll-y-contain">
        <div className="mx-auto flex w-[92%] max-w-md flex-1 flex-col items-center justify-center pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:pt-[max(1.5rem,env(safe-area-inset-top))]">
          {children}
        </div>
      </div>
    </div>
  )
}
