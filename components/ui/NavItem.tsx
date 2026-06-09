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
        'flex h-11 flex-shrink-0 items-center border-b-[3px] px-5 text-base text-text transition-colors duration-short ease-out md:border-b-0 md:border-l-[3px] md:px-6',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-text',
        isActive
          ? 'border-text bg-accent-dim font-medium'
          : 'border-transparent bg-transparent font-normal'
      )}
    >
      {label}
    </Link>
  )
}
