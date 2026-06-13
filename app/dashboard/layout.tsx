import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import NavItem from '@/components/ui/NavItem'
import { Toaster } from '@/components/ui/sonner'
import AgentStatusProvider from '@/components/ui/AgentStatusProvider'
import AgentStatusPill from '@/components/ui/AgentStatusPill'
import BottomNav from '@/components/ui/BottomNav'

export const dynamic = 'force-dynamic'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <AgentStatusProvider>
      <div className="flex h-screen flex-col overflow-hidden bg-bg md:flex-row">
        {/* Mobile top header — white chrome, pink wordmark + status pill */}
        <header className="flex flex-shrink-0 items-center justify-between border-b border-border bg-bg px-4 py-3 md:hidden">
          <Link href="/dashboard" className="leading-none">
            <span className="font-display italic" style={{ fontSize: 'var(--text-lg)', color: 'var(--color-text)' }}>
              Heard
            </span>
          </Link>
          <AgentStatusPill size="compact" className="md:hidden" />
        </header>

        {/* Desktop sidebar — unchanged, hidden on mobile */}
        <aside className="hidden w-full flex-shrink-0 flex-col border-r border-border bg-accent md:flex md:w-[220px]">
          <div
            className="border-b px-6 py-5"
            style={{ borderColor: 'var(--color-accent-dim)' }}
          >
            <Link href="/dashboard">
              <span
                className="font-display italic block"
                style={{ fontSize: 'var(--text-xl)', color: 'var(--color-text)' }}
              >
                Heard
              </span>
              <span
                className="block"
                style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text)', opacity: 0.6 }}
              >
                by apol.ai
              </span>
            </Link>
            <div className="mt-3">
              <AgentStatusPill />
            </div>
          </div>

          <nav className="flex flex-1 flex-col py-3 px-2">
            <NavItem href="/dashboard" label="Activity" exact />
            <NavItem href="/dashboard/reviews" label="Reviews" />
            <NavItem href="/dashboard/agents" label="Agents" />
            <NavItem href="/dashboard/settings" label="Settings" />
          </nav>

          <div
            className="border-t px-6 py-4"
            style={{ borderColor: 'var(--color-accent-dim)' }}
          >
            <p
              style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text)', opacity: 0.6 }}
              className="truncate"
            >
              {user.email}
            </p>
          </div>
        </aside>

        {/* Main content — extra bottom padding on mobile to clear the fixed BottomNav */}
        <main className="min-h-0 flex-1 overflow-y-auto bg-bg pb-[calc(56px+env(safe-area-inset-bottom))] md:pb-0">
          {children}
        </main>

        <BottomNav />
        <Toaster position="bottom-right" />
      </div>
    </AgentStatusProvider>
  )
}
