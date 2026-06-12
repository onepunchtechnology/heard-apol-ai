export type AgentStatus = 'listening' | 'reading' | 'drafting'

export function deriveStatus(activeReviewCount: number, sweepHasDraft: boolean): AgentStatus {
  if (activeReviewCount === 0) return 'listening'
  if (sweepHasDraft) return 'drafting'
  return 'reading'
}
