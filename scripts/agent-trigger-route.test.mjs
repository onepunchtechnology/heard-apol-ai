/**
 * Invariants for the agent trigger route (POST /api/agent/trigger).
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const trigger = readFileSync('app/api/agent/trigger/route.ts', 'utf8')

// ── Auth guard ────────────────────────────────────────────────────────────────

assert.match(trigger, /getUser\(\)/, 'trigger: must authenticate the caller')
assert.match(trigger, /401/, 'trigger: must return 401 when unauthenticated')

// ── Store ownership ───────────────────────────────────────────────────────────

assert.match(
  trigger,
  /eq\('user_id', user\.id\)/,
  'trigger: store lookup must be scoped to the authenticated user',
)
assert.match(trigger, /404/, 'trigger: must return 404 when store is not found')

// ── Graceful degradation when Cloud Run is not configured ────────────────────

assert.match(trigger, /CLOUD_RUN_JOB_NAME/, 'trigger: must read job name from env')
assert.match(trigger, /GOOGLE_CLOUD_PROJECT/, 'trigger: must read project from env')
assert.match(trigger, /503/, 'trigger: must return 503 when Cloud Run env vars are missing')

// ── Passes store scope and mode to Cloud Run job ──────────────────────────────

assert.match(
  trigger,
  /STORE_ID/,
  'trigger: must pass STORE_ID as a Cloud Run env override so the job is scoped',
)
assert.match(
  trigger,
  /store\.id/,
  'trigger: must use the authenticated store ID, not a hardcoded value',
)
assert.match(trigger, /MODE/, 'trigger: must pass MODE (single|sweep) to the Cloud Run job')

// ── Error propagation ─────────────────────────────────────────────────────────

assert.match(trigger, /502/, 'trigger: must return 502 when Cloud Run rejects the job')

console.log('agent-trigger-route: all checks passed')
