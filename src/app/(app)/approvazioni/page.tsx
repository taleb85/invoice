import { redirect } from 'next/navigation'
import { getProfile } from '@/utils/supabase/server'
import AppPageHeaderStrip from '@/components/AppPageHeaderStrip'
import { ApprovalQueue } from '@/components/approval/approval-queue'

export const dynamic = 'force-dynamic'

export default async function ApprovazioniPage() {
  const profile = await getProfile()
  if (!profile || !['admin', 'admin_sede'].includes(profile.role ?? '')) {
    redirect('/')
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <AppPageHeaderStrip>
        <div className="min-w-0">
          <h1 className="text-base font-bold text-app-fg sm:text-lg">Approvazioni</h1>
          <p className="text-xs text-app-fg-muted">Fatture in attesa di approvazione sopra soglia</p>
        </div>
      </AppPageHeaderStrip>

      <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
        <ApprovalQueue />
      </div>
    </div>
  )
}
