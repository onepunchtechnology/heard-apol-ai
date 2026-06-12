'use client'

import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export type AgentStatus = 'listening' | 'reading' | 'drafting'

const AgentStatusContext = createContext<AgentStatus>('listening')

export function useAgentStatus(): AgentStatus {
  return useContext(AgentStatusContext)
}

function deriveStatus(processingCount: number, sweepHasDraft: boolean): AgentStatus {
  if (processingCount === 0) return 'listening'
  if (sweepHasDraft) return 'drafting'
  return 'reading'
}

export default function AgentStatusProvider({ children }: { children: React.ReactNode }) {
  const [processingCount, setProcessingCount] = useState(0)
  const [sweepHasDraft, setSweepHasDraft] = useState(false)
  const mountedRef = useRef(false)

  useEffect(() => {
    mountedRef.current = true
    const supabase = createClient()

    async function syncProcessingCount() {
      const { count } = await supabase
        .from('reviews')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'processing')
      const newCount = count ?? 0
      if (!mountedRef.current) return
      if (newCount === 0) setSweepHasDraft(false)
      setProcessingCount(newCount)
    }

    syncProcessingCount()

    const channel = supabase
      .channel('agent-status')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'reviews' },
        syncProcessingCount
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'review_actions' },
        () => { if (mountedRef.current) setSweepHasDraft(true) }
      )
      .subscribe()

    return () => {
      mountedRef.current = false
      supabase.removeChannel(channel)
    }
  }, [])

  const status = deriveStatus(processingCount, sweepHasDraft)

  return (
    <AgentStatusContext.Provider value={status}>
      {children}
    </AgentStatusContext.Provider>
  )
}
