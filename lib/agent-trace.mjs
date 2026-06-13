// Pure helpers for rendering agent run traces. Plain ESM so the Node test
// runner (scripts/*.test.mjs) can import it without a TS toolchain.

/**
 * @typedef {{ label: string, data: string, color: string }} TraceLine
 */

/**
 * @param {unknown} trace
 * @returns {TraceLine[]}
 */
export function parseTrace(trace) {
  if (!trace) return []
  const raw = trace
  const steps = Array.isArray(raw)
    ? raw
    : Array.isArray(raw.steps)
    ? raw.steps
    : []

  return steps
    .filter((s) => s.step !== 'claim' && !(s.step === 'fetch_order_context' && String(s.status ?? '') === 'skipped'))
    .map((s) => {
      const status = String(s.status ?? '')
      let label = String(s.step ?? '').toUpperCase()
      let data = status
      let color = status === 'complete' ? 'var(--color-success)' : status === 'skipped' ? 'var(--color-muted)' : 'var(--color-escalate)'

      switch (s.step) {
        case 'classify': {
          label = 'CLASSIFIER'
          const r = s.result
          if (r) {
            const parts = []
            if (r.sentiment_label) parts.push(`sentiment: ${r.sentiment_label}`)
            if (r.needs_order_context !== undefined) parts.push(`needs_order_context: ${r.needs_order_context}`)
            if (r.risk_score !== undefined) parts.push(`risk: ${r.risk_score}`)
            if (r.confidence !== undefined) parts.push(`confidence: ${Number(r.confidence).toFixed(2)}`)
            data = parts.join(' | ')
          }
          break
        }
        case 'brand_voice_rag': {
          label = 'BRAND VOICE RAG'
          const snippets = s.snippets
          const count = s.matched_count ?? (snippets ? snippets.length : 0)
          data = `${count} snippet${count !== 1 ? 's' : ''} matched`
          color = 'var(--color-muted)'
          break
        }
        case 'fetch_order_context':
          label = 'SHOPIFY MCP'
          data = s.found ? 'order context fetched' : 'no order found'
          if (s.status === 'skipped') { data = 'skipped'; color = 'var(--color-muted)' }
          break
        case 'draft':
          label = 'DRAFTER'
          data = `draft generated${s.confidence ? ` | confidence: ${(Number(s.confidence) / 100).toFixed(2)}` : ''}`
          break
        case 'guardrails': {
          label = 'GUARDRAILS'
          const passed = s.passed
          const flags = s.fired_flags
          if (passed === true) {
            data = 'pass | violations: 0'
          } else if (passed === false) {
            const rule = flags && flags[0] ? ` | rule: "${flags[0]}"` : ''
            data = `blocked | violations: ${(flags && flags.length) ?? 1}${rule}`
            color = 'var(--color-escalate)'
          }
          break
        }
        case 'post':
          label = 'POSTED'
          if (status === 'complete') {
            data = s.posted ? 'reply posted' : 'complete'
          } else if (status === 'skipped') {
            data = 'escalated — skipped'
            color = 'var(--color-muted)'
          }
          break
      }

      return { label, data, color }
    })
}

// Reorder so blocked/escalate-colored steps come first. Stable for all other
// steps. Used as the progressive-disclosure default for runs needing attention.
/**
 * @param {TraceLine[]} lines
 * @returns {TraceLine[]}
 */
export function prioritizeTrace(lines) {
  const isBlocked = (l) => l.color === 'var(--color-escalate)'
  const blocked = lines.filter(isBlocked)
  const rest = lines.filter((l) => !isBlocked(l))
  return [...blocked, ...rest]
}
