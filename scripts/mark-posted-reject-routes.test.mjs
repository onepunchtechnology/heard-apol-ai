/**
 * Invariants for the mark-posted and reject review API routes.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const markPosted = readFileSync('app/api/reviews/[id]/mark-posted/route.ts', 'utf8')
const reject = readFileSync('app/api/reviews/[id]/reject/route.ts', 'utf8')

// ── mark-posted: auth + ownership ────────────────────────────────────────────

assert.match(markPosted, /getUser\(\)/, 'mark-posted: must authenticate the caller')
assert.match(markPosted, /401/, 'mark-posted: must return 401 when unauthenticated')
assert.match(markPosted, /403/, 'mark-posted: must return 403 when user does not own the store')

assert.match(
  markPosted,
  /storeData\.user_id\s*!==\s*user\.id/,
  'mark-posted: must compare store.user_id to user.id before acting',
)

// ── mark-posted: no external platform call ───────────────────────────────────
// mark-posted is for Google manual_paste mode: the merchant already posted
// the reply themselves and is recording it in the app. No platform API call needed.

assert.doesNotMatch(
  markPosted,
  /fetch\(/,
  'mark-posted: must not call any external platform APIs — merchant posts manually',
)

// ── mark-posted: persists approved state and audit fields ────────────────────

assert.match(
  markPosted,
  /status.*approved|approved.*status/,
  "mark-posted: must set review status to 'approved'",
)
assert.match(markPosted, /final_reply/, 'mark-posted: must persist the final_reply')
assert.match(
  markPosted,
  /reviewed_by.*user\.id|user\.id.*reviewed_by/,
  'mark-posted: must record reviewed_by for audit trail',
)
assert.match(markPosted, /reviewed_at/, 'mark-posted: must record reviewed_at timestamp')

// ── reject: auth + ownership ──────────────────────────────────────────────────

assert.match(reject, /getUser\(\)/, 'reject: must authenticate the caller')
assert.match(reject, /401/, 'reject: must return 401 when unauthenticated')
assert.match(reject, /403/, 'reject: must return 403 when user does not own the store')

assert.match(
  reject,
  /storeData\.user_id\s*!==\s*user\.id/,
  'reject: must compare store.user_id to user.id before acting',
)

// ── reject: no external call, correct status, audit trail ────────────────────

assert.doesNotMatch(
  reject,
  /fetch\(/,
  'reject: must not make any external API calls — rejection is internal-only',
)

assert.match(
  reject,
  /status.*rejected|rejected.*status/,
  "reject: must set review status to 'rejected'",
)
assert.match(
  reject,
  /reviewed_by.*user\.id|user\.id.*reviewed_by/,
  'reject: must record reviewed_by for audit trail',
)
assert.match(reject, /reviewed_at/, 'reject: must record reviewed_at timestamp')

console.log('mark-posted-reject-routes: all checks passed')
