'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

interface NavItemProps {
  href: string
  label: string
  exact?: boolean
}

export default function NavItem({ href, label, exact }: NavItemProps) {
  const pathname = usePathname()
  const isActive = exact ? pathname === href : pathname.startsWith(href)

  return (
    <Link
      href={href}
      className={cn(
        'flex h-10 flex-shrink-0 items-center rounded-lg px-3 text-sm transition-colors duration-short ease-out',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-text',
        isActive
          ? 'bg-surface-2 font-medium text-text'
          : 'font-normal text-muted hover:bg-surface'
      )}
    >
      {label}
    </Link>
  )
}
