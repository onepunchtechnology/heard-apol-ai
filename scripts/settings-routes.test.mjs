/**
 * Invariants for the settings API routes (reply-mode and brand-voice).
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const replyMode = readFileSync('app/api/settings/reply-mode/route.ts', 'utf8')
const brandVoice = readFileSync('app/api/settings/brand-voice/route.ts', 'utf8')

// ── reply-mode: auth + enum validation ───────────────────────────────────────

assert.match(replyMode, /getUser\(\)/, 'reply-mode: must authenticate the caller')
assert.match(replyMode, /401/, 'reply-mode: must return 401 when unauthenticated')

assert.match(
  replyMode,
  /'auto_post'.*'manual_approval'|'manual_approval'.*'auto_post'/,
  "reply-mode: must validate against exactly the two allowed enum values",
)
assert.match(replyMode, /400/, 'reply-mode: must return 400 for any value outside the enum')
assert.match(replyMode, /404/, 'reply-mode: must return 404 when store is not found')

// The route must find the store by user_id to prevent cross-tenant writes
assert.match(
  replyMode,
  /eq\('user_id', user\.id\)/,
  'reply-mode: store lookup must be scoped to the authenticated user',
)

// ── brand-voice: auth + upsert shape ─────────────────────────────────────────

assert.match(brandVoice, /getUser\(\)/, 'brand-voice: must authenticate the caller')
assert.match(brandVoice, /401/, 'brand-voice: must return 401 when unauthenticated')
assert.match(brandVoice, /404/, 'brand-voice: must return 404 when store is not found')

// Two-tone brand voice — both positive and negative tones must be persisted
assert.match(brandVoice, /tone_positive/, 'brand-voice: must save tone_positive')
assert.match(brandVoice, /tone_negative/, 'brand-voice: must save tone_negative')

// sample_replies drives cold-start RAG grounding
assert.match(brandVoice, /sample_replies/, 'brand-voice: must persist sample_replies')

// Upsert must conflict-target store_id to avoid duplicate brand_voice_config rows
assert.match(
  brandVoice,
  /onConflict.*store_id/,
  "brand-voice: upsert must conflict-target 'store_id' to prevent duplicate rows",
)

console.log('settings-routes: all checks passed')
