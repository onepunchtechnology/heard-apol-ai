import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

const loginPage = readFileSync('app/(auth)/login/page.tsx', 'utf8')
const middleware = readFileSync('middleware.ts', 'utf8')

// New users land on /onboard (setup wizard); redirect passes through /auth/confirm
assert.match(
  loginPage,
  /emailRedirectTo:\s*`\$\{window\.location\.origin\}\/auth\/confirm\?next=\/onboard`/,
  'magic links should return through /auth/confirm before entering /onboard',
)
assert.match(
  loginPage,
  /redirectTo:\s*`\$\{window\.location\.origin\}\/auth\/confirm\?next=\/onboard`/,
  'Google OAuth should return through /auth/confirm before entering /onboard',
)

assert.ok(existsSync('app/auth/confirm/route.ts'), 'auth confirmation route should exist')

assert.match(
  middleware,
  /pathname\.startsWith\('\/auth\/confirm'\)/,
  'middleware should allow unauthenticated requests to /auth/confirm',
)

const confirmRoute = readFileSync('app/auth/confirm/route.ts', 'utf8')

assert.match(confirmRoute, /verifyOtp\(/, 'confirmation route should verify the token hash')
assert.match(confirmRoute, /token_hash/, 'confirmation route should read token_hash')
assert.match(confirmRoute, /type/, 'confirmation route should read the email OTP type')
assert.match(
  confirmRoute,
  /next\.startsWith\('\/\/'\)/,
  'confirmation route should reject protocol-relative next redirects',
)
