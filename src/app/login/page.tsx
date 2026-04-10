import LoginPageClient from './LoginPageClient'

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f2040] via-[#1a3050] to-[#0e3060] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative blobs */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-80 h-80 bg-cyan-400/10 rounded-full blur-3xl pointer-events-none" />
      <LoginPageClient />
    </div>
  )
}
