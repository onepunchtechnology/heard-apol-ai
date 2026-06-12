import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const demoAuthRoute = readFileSync('app/api/auth/demo/route.ts', 'utf8')

assert.match(
  demoAuthRoute,
  /export const dynamic = 'force-dynamic'/,
  'demo auth route must be dynamic so Vercel build does not prerender Supabase admin client access'
)
