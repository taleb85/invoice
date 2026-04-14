'use client'

import { useSearchParams } from 'next/navigation'
import LoginForm from '@/app/login/LoginForm'

function safeNextPath(raw: string | null): string {
  const p = (raw ?? '/').trim() || '/'
  if (!p.startsWith('/') || p.startsWith('//')) return '/'
  return p
}

export default function AccessoLoginClient() {
  const searchParams = useSearchParams()
  const nextPath = safeNextPath(searchParams.get('next'))
  return <LoginForm sessionGateNext={nextPath} />
}
