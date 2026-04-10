import LoginPageClient from './LoginPageClient'

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#020817] via-primary to-[#0a1628] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative glows */}
      <div className="absolute -top-40 -left-40 w-[500px] h-[500px] bg-cyan-500/8 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-cyan-400/6 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/80 rounded-full blur-3xl pointer-events-none" />
      <LoginPageClient />
    </div>
  )
}
