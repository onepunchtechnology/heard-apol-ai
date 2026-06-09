import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import NavItem from '@/components/ui/NavItem'
import { Toaster } from '@/components/ui/sonner'

export const dynamic = 'force-dynamic'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: 'var(--color-bg)' }}>
      <aside
        className="flex flex-col flex-shrink-0"
        style={{
          width: '220px',
          backgroundColor: 'var(--color-accent)',
          borderRight: '1px solid var(--color-border)',
        }}
      >
        <div
          className="px-6 py-6 border-b"
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
        </div>

        <nav className="flex flex-col py-4 flex-1">
          <NavItem href="/dashboard" label="Activity" exact />
          <NavItem href="/dashboard/reviews" label="Reviews" />
          <NavItem href="/dashboard/agents" label="Agents" />
          <NavItem href="/dashboard/settings" label="Settings" />
        </nav>

        <div
          className="px-6 py-4 border-t"
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

      <main className="flex-1 overflow-y-auto" style={{ backgroundColor: 'var(--color-bg)' }}>
        {children}
      </main>
      <Toaster position="bottom-right" />
    </div>
  )
}
