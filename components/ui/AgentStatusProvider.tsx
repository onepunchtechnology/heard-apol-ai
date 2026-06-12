'use client'

import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { deriveStatus, type AgentStatus } from '@/lib/agent-status'

const AgentStatusContext = createContext<AgentStatus>('listening')

export function useAgentStatus(): AgentStatus {
  return useContext(AgentStatusContext)
}

export default function AgentStatusProvider({ children }: { children: React.ReactNode }) {
  const [activeReviewCount, setActiveReviewCount] = useState(0)
  const [sweepHasDraft, setSweepHasDraft] = useState(false)
  const mountedRef = useRef(false)

  useEffect(() => {
    mountedRef.current = true
    const supabase = createClient()

    async function syncActiveReviewCount() {
      const { count } = await supabase
        .from('reviews')
        .select('id', { count: 'exact', head: true })
        .in('status', ['pending', 'processing'])
      const newCount = count ?? 0
      if (!mountedRef.current) return
      if (newCount === 0) setSweepHasDraft(false)
      setActiveReviewCount(newCount)
    }

    syncActiveReviewCount()

    const channel = supabase
      .channel('agent-status')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reviews' },
        syncActiveReviewCount
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'review_actions' },
        () => { if (mountedRef.current) setSweepHasDraft(true) }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') syncActiveReviewCount()
      })

    return () => {
      mountedRef.current = false
      supabase.removeChannel(channel)
    }
  }, [])

  const status = deriveStatus(activeReviewCount, sweepHasDraft)

  return (
    <AgentStatusContext.Provider value={status}>
      {children}
    </AgentStatusContext.Provider>
  )
}
