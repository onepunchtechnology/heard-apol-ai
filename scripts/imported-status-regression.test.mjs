import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const activityPage = readFileSync(join(root, 'app/dashboard/page.tsx'), 'utf8')
const reviewsPage = readFileSync(join(root, 'app/dashboard/reviews/page.tsx'), 'utf8')
const reviewsClient = readFileSync(join(root, 'app/dashboard/reviews/ReviewsClient.tsx'), 'utf8')
const agentsPage = readFileSync(join(root, 'app/dashboard/agents/page.tsx'), 'utf8')
const dbTypes = readFileSync(join(root, 'lib/types/database.ts'), 'utf8')

assert.match(dbTypes, /'imported'/, 'generated database types must include imported review status')
assert.match(reviewsPage, /'imported'/, 'Reviews page should load imported historical reviews intentionally')
assert.match(reviewsClient, /Imported/, 'Reviews UI should label imported historical replies distinctly')
assert.match(
  agentsPage,
  /not\('status', 'eq', 'imported'\)/,
  'Agents page must exclude imported historical replies from Agent Replay',
)
assert.match(
  activityPage,
  /not\('status', 'eq', 'imported'\)/,
  'Activity totals must exclude imported historical replies from handled counts',
)

console.log('imported-status-regression ok')
