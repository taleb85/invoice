'use client'

import { useSearchParams } from 'next/navigation'
import { safeNextPath } from '@/lib/safe-next-path'
import LoginForm from './LoginForm'

export default function LoginPageClient() {
  const searchParams = useSearchParams()
  const rawNext = searchParams.get('next')
  const sessionGateNext = rawNext != null ? safeNextPath(rawNext) : undefined
  return <LoginForm sessionGateNext={sessionGateNext} />
}
