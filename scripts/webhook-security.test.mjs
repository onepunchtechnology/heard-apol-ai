/**
 * Security and ordering invariants for the Judge.me webhook handler.
 * These tests catch regressions that wouldn't show up in type-checking.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const webhook = readFileSync('app/api/webhooks/judgeme/route.ts', 'utf8')

// ── Security: Judge.me authenticity model ────────────────────────────────────

assert.match(
  webhook,
  /Judge\.me does not sign webhooks/,
  'webhook must document that Judge.me does not provide HMAC signatures'
)

assert.doesNotMatch(
  webhook,
  /timingSafeEqual|createHmac|Missing signature/,
  'webhook must not assert nonexistent Judge.me HMAC verification'
)

assert.match(
  webhook,
  /request\.headers\.get\('x-judgeme-shop-domain'\)/,
  'webhook must read Judge.me shop domain from headers'
)

assert.match(
  webhook,
  /\.eq\('shopify_domain', shopDomain\)/,
  'webhook authenticity check must match the shop domain to a configured store'
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
