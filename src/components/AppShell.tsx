import SidebarController from './SidebarController'
import { UserProvider } from '@/lib/me-context'
import { LocaleProvider } from '@/lib/locale-context'

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <LocaleProvider>
      <UserProvider>
        <div className="h-full flex">
          <SidebarController />
          <main className="flex-1 overflow-y-auto pt-14 md:pt-0">
            {children}
          </main>
        </div>
      </UserProvider>
    </LocaleProvider>
  )
}
