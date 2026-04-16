import type { ReactNode } from 'react'

/** Sfondo full-screen con glow: stesso layout di `/login` e `/accesso`. */
export default function LoginBrandedShell({ children }: { children: ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-0 flex flex-col overflow-x-hidden overflow-y-auto overscroll-y-contain bg-gradient-to-br from-[var(--app-canvas-from)] via-[var(--app-canvas-via)] to-[var(--app-canvas-to)]"
    >
      <div className="pointer-events-none absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-app-line-10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-app-a-20 blur-3xl" />
      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-sm flex-1 flex-col items-center justify-center px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6 sm:pt-6 sm:pb-6">
        {children}
      </div>
    </div>
  )
}
