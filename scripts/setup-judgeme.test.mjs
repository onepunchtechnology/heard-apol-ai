/**
 * Invariants for the Judge.me setup route (POST /api/setup/judgeme).
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const judgeme = readFileSync('app/api/setup/judgeme/route.ts', 'utf8')

// ── Auth guard ────────────────────────────────────────────────────────────────

assert.match(judgeme, /getUser\(\)/, 'setup/judgeme: must authenticate the caller')
assert.match(judgeme, /401/, 'setup/judgeme: must return 401 when unauthenticated')

// ── Input validation ──────────────────────────────────────────────────────────

assert.match(
  judgeme,
  /judgeme_api_token/,
  'setup/judgeme: must require judgeme_api_token in request body',
)
assert.match(judgeme, /400/, 'setup/judgeme: must return 400 when token is missing')

// ── Token verification before persisting ─────────────────────────────────────
// Verify against Judge.me API BEFORE saving, so an invalid token never lands in the DB.

const verifyIdx = judgeme.indexOf('verifyRes')
const updateIdx = judgeme.indexOf('.update({')

assert.ok(verifyIdx !== -1, 'setup/judgeme: must verify token against the Judge.me API')
assert.ok(updateIdx !== -1, 'setup/judgeme: must persist the verified token to the store')
assert.ok(
  verifyIdx < updateIdx,
  'setup/judgeme: token verification must happen BEFORE the store update',
)

assert.match(judgeme, /422/, 'setup/judgeme: must return 422 when token is invalid or store not ready')

// ── Silent import failure — never blocks the setup wizard ────────────────────
// CLAUDE.md: "Import failure is silent — never blocks the wizard."

assert.match(
  judgeme,
  /try\s*\{/,
  'setup/judgeme: existing-reply import must be wrapped in try/catch',
)
assert.match(
  judgeme,
  /catch\s*\{/,
  'setup/judgeme: import failure must be caught silently (never blocks wizard)',
)

// ── Defensive reply field extraction ─────────────────────────────────────────
// Judge.me reply shape is not fully verified; code must check multiple field names.

assert.match(
  judgeme,
  /extractReplyText/,
  'setup/judgeme: must use a defensive helper to extract reply text',
)
assert.match(
  judgeme,
  /curated_reply/,
  'setup/judgeme: extractReplyText must check curated_reply field',
)
assert.match(
  judgeme,
  /\.body/,
  'setup/judgeme: extractReplyText must check .body on reply objects',
)

// ── Import cap ────────────────────────────────────────────────────────────────

assert.match(
  judgeme,
  /slice\(0, 20\)/,
  'setup/judgeme: must cap imported replies at 20 to avoid bloating sample_replies',
)

// ── Response shape ────────────────────────────────────────────────────────────

assert.match(judgeme, /imported_replies/, 'setup/judgeme: must return imported_replies array')
assert.match(judgeme, /review_count/, 'setup/judgeme: must return review_count')
assert.match(judgeme, /reply_count/, 'setup/judgeme: must return reply_count')

console.log('setup-judgeme: all checks passed')
