'use client'

import { useSearchParams } from 'next/navigation'
import LoginForm from '@/app/login/LoginForm'
import { safeNextPath } from '@/lib/safe-next-path'

export default function AccessoLoginClient() {
  const searchParams = useSearchParams()
  const nextPath = safeNextPath(searchParams.get('next'))
  return <LoginForm sessionGateNext={nextPath} />
}
