import type { ReactNode } from 'react'

/** Sfondo full-screen Deep Aurora: allineato a dashboard/mock (`globals.css`). Usato da `/login`, `/accesso`, ecc. */
export default function LoginBrandedShell({ children }: { children: ReactNode }) {
  return (
    <div
      data-deep-aurora-public-shell
      className="fixed inset-0 z-0 flex flex-col overflow-x-hidden overflow-y-auto overscroll-y-contain bg-transparent"
    >
      {/* Luce cenitale soft + vignetta per contrasto carte */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 min-h-[120%] bg-[radial-gradient(ellipse_72%_48%_at_50%_-8%,rgb(56_189_248/0.14),transparent_58%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 min-h-[300vh] bg-gradient-to-b from-[#020617]/45 via-transparent to-[#020617]/55"
      />
      {/* Auréole */}
      <div className="pointer-events-none absolute -bottom-36 -right-28 h-[22rem] w-[22rem] rounded-full bg-sky-400/14 blur-[100px]" />
      <div className="pointer-events-none absolute bottom-12 -left-20 h-[18rem] w-[18rem] rounded-full bg-indigo-500/18 blur-[88px]" />
      <div className="relative z-10 mx-auto flex min-h-dvh w-[92%] max-w-md flex-1 flex-col items-center justify-start pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:justify-center sm:pt-[max(1.5rem,env(safe-area-inset-top))]">
        {children}
      </div>
    </div>
  )
}
