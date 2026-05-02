import { redirect } from 'next/navigation'
import { getProfile } from '@/utils/supabase/server'
import { isCorporateSedeAdminRole, isMasterAdminRole } from '@/lib/roles'
import { OnboardingWizard } from '@/components/onboarding/onboarding-wizard'

export const dynamic = 'force-dynamic'

export default async function OnboardingPage() {
  const profile = await getProfile()
  const isMaster = isMasterAdminRole(profile?.role)
  const canAccessOnboardingAsSedeBoss = isCorporateSedeAdminRole(profile?.role)

  if (!isMaster && !canAccessOnboardingAsSedeBoss) {
    redirect('/')
  }

  return (
    <div className="flex min-h-dvh flex-col bg-[#020617]">
      <OnboardingWizard />
    </div>
  )
}
