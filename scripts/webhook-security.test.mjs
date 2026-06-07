/**
 * Security and ordering invariants for the Judge.me webhook handler.
 * These tests catch regressions that wouldn't show up in type-checking.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import crypto from 'node:crypto'

const webhook = readFileSync('app/api/webhooks/judgeme/route.ts', 'utf8')

// ── Security: HMAC verification ──────────────────────────────────────────────

assert.match(
  webhook,
  /timingSafeEqual/,
  'webhook HMAC comparison must use timingSafeEqual to prevent timing attacks'
)

assert.doesNotMatch(
  webhook,
  /signature\s*===\s*expected|expectedSig\s*===\s*signature/,
  'webhook must not compare signatures with === (timing-unsafe)'
)

assert.match(
  webhook,
  /createHmac\('sha256'/,
  'webhook must use HMAC-SHA256 to verify the Judge.me signature'
)

assert.match(
  webhook,
  /\.digest\('base64'\)/,
  'HMAC digest must be base64 to match the JUDGEME-HMAC-SHA256 header format'
)

// ── Ordering: persist before triggering agent ────────────────────────────────
// CLAUDE.md: "persist review to Supabase FIRST, then return 200, then trigger
//             Cloud Run async. Returning 200 before the DB write loses reviews."

const upsertIdx = webhook.indexOf('.upsert(')
const triggerIdx = webhook.indexOf('triggerAgent(')

assert.ok(upsertIdx !== -1, 'webhook must upsert the review into Supabase')
assert.ok(triggerIdx !== -1, 'webhook must call triggerAgent after persisting')
assert.ok(
  upsertIdx < triggerIdx,
  'upsert must come before triggerAgent — persisting FIRST prevents data loss if Cloud Run fails'
)

// ── Idempotency: duplicate webhooks must not create duplicate reviews ─────────

assert.match(
  webhook,
  /ignoreDuplicates:\s*true/,
  'upsert must set ignoreDuplicates:true so replayed webhooks are safe'
)

assert.match(
  webhook,
  /onConflict:\s*'external_id,store_id'/,
  'upsert conflict target must be (external_id, store_id)'
)

// ── Input validation ──────────────────────────────────────────────────────────

assert.match(
  webhook,
  /Missing signature/,
  'webhook must reject requests with no HMAC signature header'
)

assert.match(
  webhook,
  /Missing shop domain/,
  'webhook must reject requests with no x-judgeme-shop-domain header'
)

assert.match(
  webhook,
  /Missing review payload/,
  'webhook must reject payloads where review is absent'
)

// triggerAgent is fire-and-forget — it must not block the 200 response
assert.match(
  webhook,
  /triggerAgent.*\.catch\(/s,
  'triggerAgent must be called with .catch() so Cloud Run errors never fail the webhook response'
)

console.log('webhook-security: all checks passed')
