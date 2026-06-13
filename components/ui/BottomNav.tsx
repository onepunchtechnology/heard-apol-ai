'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Activity, Inbox, Bot, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Tab {
  href: string
  label: string
  Icon: typeof Activity
  exact?: boolean
}

const TABS: Tab[] = [
  { href: '/dashboard', label: 'Activity', Icon: Activity, exact: true },
  { href: '/dashboard/reviews', label: 'Reviews', Icon: Inbox },
  { href: '/dashboard/agents', label: 'Agents', Icon: Bot },
  { href: '/dashboard/settings', label: 'Settings', Icon: Settings },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-bg md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {TABS.map(({ href, label, Icon, exact }) => {
        const isActive = exact ? pathname === href : pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1 py-2 text-[11px]',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent-dim',
              isActive ? 'text-text' : 'text-muted',
            )}
          >
            <span
              className={cn(
                'flex h-7 w-12 items-center justify-center rounded-full transition-colors',
                isActive ? 'bg-surface-2' : 'bg-transparent',
              )}
            >
              <Icon size={18} strokeWidth={isActive ? 2.25 : 1.75} aria-hidden="true" />
            </span>
            <span className={cn(isActive && 'font-medium')}>{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
