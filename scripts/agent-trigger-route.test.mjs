/**
 * Invariants for the agent trigger route (POST /api/agent/trigger).
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const trigger = readFileSync('app/api/agent/trigger/route.ts', 'utf8')
const agentTrigger = readFileSync('lib/agent-trigger.ts', 'utf8')

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

assert.match(trigger, /GCP_PROJECT_NUMBER/, 'trigger: must read project number from env')
assert.match(trigger, /503/, 'trigger: must return 503 when Cloud Run env vars are missing')

// ── Delegates store scope and mode to Cloud Run job helper ────────────────────

assert.match(
  trigger,
  /triggerCloudRunJob\(\{\s*mode,\s*storeId: store\.id,\s*reviewId: reviewId \?\? undefined,\s*\}\)/,
  'trigger: must delegate mode, store ID, and optional review ID to Cloud Run helper',
)

// ── Cloud Run helper targets the expected job and env overrides ───────────────

assert.match(agentTrigger, /const GCP_PROJECT_ID = 'heard-apol-ai'/, 'agent trigger: must target the Heard GCP project')
assert.match(agentTrigger, /const GCP_REGION = 'us-central1'/, 'agent trigger: must target the Cloud Run region')
assert.match(agentTrigger, /const GCP_JOB_NAME = 'heard-agent'/, 'agent trigger: must target the agent job')
assert.match(agentTrigger, /process\.env\.GCP_PROJECT_NUMBER/, 'agent trigger: must read project number from env')
assert.match(
  agentTrigger,
  /projects\/\$\{GCP_PROJECT_ID\}\/locations\/\$\{GCP_REGION\}\/jobs\/\$\{GCP_JOB_NAME\}:run/,
  'agent trigger: must call the Cloud Run Jobs run endpoint',
)

assert.match(
  agentTrigger,
  /STORE_ID/,
  'trigger: must pass STORE_ID as a Cloud Run env override so the job is scoped',
)
assert.match(
  agentTrigger,
  /value: storeId/,
  'agent trigger: must use the provided store ID, not a hardcoded value',
)
assert.match(agentTrigger, /MODE/, 'trigger: must pass MODE (single|sweep) to the Cloud Run job')
assert.match(agentTrigger, /REVIEW_ID/, 'trigger: must pass REVIEW_ID to the Cloud Run job for single-review runs')

// ── Error propagation ─────────────────────────────────────────────────────────

assert.match(trigger, /502/, 'trigger: must return 502 when Cloud Run rejects the job')

console.log('agent-trigger-route: all checks passed')
