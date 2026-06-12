'use client'

import { useAgentStatus } from './AgentStatusProvider'
import { cn } from '@/lib/utils'

interface AgentStatusPillProps {
  size?: 'default' | 'compact'
  className?: string
}

const BORDER = {
  listening: 'border-[var(--color-agent-border-rest)]',
  reading: 'border-[var(--color-agent-border-rest)]',
  drafting: 'border-[var(--color-agent-border-active)]',
}

export default function AgentStatusPill({ size = 'default', className }: AgentStatusPillProps) {
  const status = useAgentStatus()
  const isCompact = size === 'compact'

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`Agent status: ${status}`}
      className={cn(
        'inline-flex items-center gap-[7px] rounded-full border-[1.5px] bg-[var(--color-bg)]',
        isCompact ? 'px-[9px] py-1' : 'px-[11px] py-[5px]',
        BORDER[status],
        className
      )}
      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}
    >
      {/* Dot */}
      <span
        className={cn(
          'relative flex-shrink-0 rounded-full bg-[var(--color-agent-dot)]',
          isCompact ? 'h-[6px] w-[6px]' : 'h-[7px] w-[7px]',
          status === 'reading' && 'agent-blink',
          status === 'drafting' && 'agent-pulse-ring'
        )}
      />
      {/* Label */}
      <span
        className={cn(
          'font-medium leading-none tracking-wide text-[var(--color-agent-text)]',
          isCompact ? 'text-[9px]' : 'text-[10px]'
        )}
      >
        {status}
      </span>
    </div>
  )
}
