import LoginPageClient from './LoginPageClient'

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#020817] via-primary to-[#0a1628] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative glows */}
      <div className="absolute -top-40 -left-40 w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-cyan-400/8 rounded-full blur-3xl pointer-events-none" />
      <div className="relative z-10 flex w-full justify-center">
        <LoginPageClient />
      </div>
    </div>
  )
}
