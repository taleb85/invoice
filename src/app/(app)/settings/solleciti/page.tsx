import { redirect } from 'next/navigation'
import { getProfile, getRequestAuth } from '@/utils/supabase/server'
import { fetchSollecitiReminderSettings } from '@/lib/sollecito-aging'
import SollecitiSettingsClient from './solleciti-settings-client'

export const dynamic = 'force-dynamic'

export default async function SollecitiSettingsPage() {
  const { user, supabase } = await getRequestAuth()
  if (!user) redirect('/login')

  const profile = await getProfile()
  if (!profile || !['admin', 'admin_sede'].includes(profile.role)) {
    redirect('/impostazioni')
  }

  const initial = await fetchSollecitiReminderSettings(supabase)

  return <SollecitiSettingsClient initial={initial} />
}
