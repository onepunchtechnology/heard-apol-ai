/**
 * Invariants for the review approve/reject API routes.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const approve = readFileSync('app/api/reviews/[id]/approve/route.ts', 'utf8')
const reject = readFileSync('app/api/reviews/[id]/reject/route.ts', 'utf8')

// ── Auth guards ───────────────────────────────────────────────────────────────

for (const [name, src] of [['approve', approve], ['reject', reject]]) {
  assert.match(src, /getUser\(\)/, `${name} route must authenticate the caller`)
  assert.match(src, /401/, `${name} route must return 401 when unauthenticated`)
  assert.match(src, /403/, `${name} route must return 403 when user does not own the store`)
  assert.match(
    src,
    /store\.user_id !== user\.id|user_id.*!==.*user\.id/,
    `${name} route must compare store.user_id to user.id before acting`
  )
}

// ── Approve: shouldHavePosted logic ──────────────────────────────────────────
// A google_business review in manual_paste mode intentionally skips posting
// (merchant posts manually). The route should only return 502 when a post was
// expected but failed — not for manual-paste google reviews.

assert.match(
  approve,
  /shouldHavePosted/,
  'approve route must use shouldHavePosted to distinguish expected vs optional posting'
)

assert.match(
  approve,
  /review\.source === 'judgeme'/,
  "approve route shouldHavePosted condition must include judgeme source"
)

assert.match(
  approve,
  /google_connection_mode.*===.*'api'|'api'.*===.*google_connection_mode/,
  'approve route must only require posting for google_business when mode is api, not manual_paste'
)

assert.match(
  approve,
  /502/,
  'approve route must return 502 when posting to a live platform fails'
)

// ── Approve: persists final_reply and audit fields ───────────────────────────

assert.match(
  approve,
  /final_reply.*reply|reply.*final_reply/,
  'approve route must persist the final_reply in review_actions'
)

assert.match(
  approve,
  /reviewed_by.*user\.id|user\.id.*reviewed_by/,
  'approve route must record reviewed_by for audit trail'
)

assert.match(
  approve,
  /reviewed_at/,
  'approve route must record reviewed_at timestamp'
)

// ── Reject: minimal update, no platform post ─────────────────────────────────

assert.doesNotMatch(
  reject,
  /fetch\(/,
  "reject route must not make any external API calls — rejection is internal-only"
)

assert.match(
  reject,
  /status.*rejected|rejected.*status/,
  "reject route must set review status to 'rejected'"
)

console.log('approve-route: all checks passed')
