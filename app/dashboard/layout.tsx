import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import NavItem from '@/components/ui/NavItem'
import { Toaster } from '@/components/ui/sonner'
import AgentStatusProvider from '@/components/ui/AgentStatusProvider'
import AgentStatusPill from '@/components/ui/AgentStatusPill'

export const dynamic = 'force-dynamic'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-bg md:flex-row">
      <aside
        className="flex w-full flex-shrink-0 flex-col border-b border-accent-dim bg-accent md:w-[220px] md:border-b-0 md:border-r md:border-border"
      >
        <AgentStatusProvider>
          <div
            className="flex items-center justify-between gap-4 border-b px-4 py-3 md:block md:px-6 md:py-5"
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
            {/* Desktop status pill - stacks below tagline on md+ */}
            <div className="hidden md:block mt-3">
              <AgentStatusPill />
            </div>
            {/* Mobile status pill - sits between logo and email in the flex row */}
            <AgentStatusPill size="compact" className="md:hidden" />
            <p
              style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text)', opacity: 0.6 }}
              className="max-w-[180px] truncate md:hidden"
            >
              {user.email}
            </p>
          </div>

          <nav className="flex min-w-0 flex-row overflow-x-auto md:flex-1 md:flex-col md:overflow-visible py-3 px-2">
            <NavItem href="/dashboard" label="Activity" exact />
            <NavItem href="/dashboard/reviews" label="Reviews" />
            <NavItem href="/dashboard/agents" label="Agents" />
            <NavItem href="/dashboard/settings" label="Settings" />
          </nav>

          <div
            className="hidden border-t px-6 py-4 md:block"
            style={{ borderColor: 'var(--color-accent-dim)' }}
          >
            <p
              style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text)', opacity: 0.6 }}
              className="truncate"
            >
              {user.email}
            </p>
          </div>
        </AgentStatusProvider>
      </aside>

      <main className="min-h-0 flex-1 overflow-y-auto bg-bg">
        {children}
      </main>
      <Toaster position="bottom-right" />
    </div>
  )
}
