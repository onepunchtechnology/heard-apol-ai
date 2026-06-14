import assert from 'node:assert/strict'
import { parseTrace, prioritizeTrace } from '../lib/agent-trace.mjs'

// parseTrace: 'claim' filtered; classify → CLASSIFIER; blocked guardrails → escalate color
{
  const lines = parseTrace({
    steps: [
      { step: 'claim', status: 'complete' },
      { step: 'classify', status: 'complete', result: { sentiment_label: 'negative', risk_score: 8, confidence: 0.94 } },
      { step: 'guardrails', status: 'complete', passed: false, fired_flags: ['competitor_mention'] },
    ],
  })
  assert.equal(lines.length, 2)
  assert.equal(lines[0].label, 'CLASSIFIER')
  assert.match(lines[0].data, /sentiment: negative/)
  assert.equal(lines[1].label, 'GUARDRAILS')
  assert.match(lines[1].data, /blocked \| violations: 1 \| rule: "competitor_mention"/)
  assert.equal(lines[1].color, 'var(--color-escalate)')
}

// prioritizeTrace: escalate-colored steps move to the front; other order stable
{
  const input = [
    { label: 'CLASSIFIER', data: '', color: 'var(--color-success)' },
    { label: 'GUARDRAILS', data: '', color: 'var(--color-escalate)' },
    { label: 'POSTED', data: '', color: 'var(--color-muted)' },
  ]
  const out = prioritizeTrace(input)
  assert.deepEqual(out.map((l) => l.label), ['GUARDRAILS', 'CLASSIFIER', 'POSTED'])
}

// prioritizeTrace: no blocked steps → order unchanged
{
  const input = [
    { label: 'CLASSIFIER', data: '', color: 'var(--color-success)' },
    { label: 'POSTED', data: '', color: 'var(--color-success)' },
  ]
  assert.deepEqual(prioritizeTrace(input).map((l) => l.label), ['CLASSIFIER', 'POSTED'])
}

console.log('agent-trace.test.mjs: all assertions passed')
