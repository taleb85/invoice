import { redirect } from 'next/navigation'
import { getProfile } from '@/utils/supabase/server'
import { isMasterAdminRole, isAdminSedeRole } from '@/lib/roles'
import { OnboardingWizard } from '@/components/onboarding/onboarding-wizard'

export const dynamic = 'force-dynamic'

export default async function OnboardingPage() {
  const profile = await getProfile()
  const isMaster = isMasterAdminRole(profile?.role)
  const isAdminSede = isAdminSedeRole(profile?.role)

  if (!isMaster && !isAdminSede) {
    redirect('/')
  }

  return (
    <div className="flex min-h-dvh flex-col bg-[#020617]">
      <OnboardingWizard />
    </div>
  )
}
