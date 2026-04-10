import SidebarController from './SidebarController'

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full flex">
      <SidebarController />
      <main className="flex-1 overflow-y-auto pt-14 md:pt-0">
        {children}
      </main>
    </div>
  )
}
