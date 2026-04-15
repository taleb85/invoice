import type { ReactNode } from 'react'

/** Sfondo full-screen con glow: stesso layout di `/login` e `/accesso`. */
export default function LoginBrandedShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#020817] via-primary to-[#0a1628] flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute -top-40 -left-40 w-[500px] h-[500px] bg-app-line-10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-app-a-20 rounded-full blur-3xl pointer-events-none" />
      <div className="relative z-10 flex w-full justify-center">{children}</div>
    </div>
  )
}
