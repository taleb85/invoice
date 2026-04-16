import type { ReactNode } from 'react'

/** Sfondo full-screen con glow: stesso layout di `/login` e `/accesso`. */
export default function LoginBrandedShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen min-h-[100dvh] items-center justify-center overflow-hidden bg-gradient-to-br from-[#020817] via-primary to-[#0a1628] p-4 sm:p-6">
      <div className="pointer-events-none absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-app-line-10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-app-a-20 blur-3xl" />
      <div className="relative z-10 mx-auto flex w-full max-w-sm justify-center">{children}</div>
    </div>
  )
}
