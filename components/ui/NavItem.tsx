'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

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
      className="flex items-center px-6 transition-colors"
      style={{
        height: '44px',
        fontSize: 'var(--text-base)',
        color: 'var(--color-text)',
        fontWeight: isActive ? 500 : 400,
        backgroundColor: isActive ? 'var(--color-accent-dim)' : 'transparent',
        borderLeft: isActive ? '3px solid var(--color-text)' : '3px solid transparent',
        transitionDuration: 'var(--duration-short)',
        transitionTimingFunction: 'var(--ease-out)',
      }}
    >
      {label}
    </Link>
  )
}
