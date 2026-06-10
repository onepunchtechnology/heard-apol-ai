import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

assert.ok(existsSync('app/page.tsx'), 'root page should exist')

const rootPage = readFileSync('app/page.tsx', 'utf8')

assert.match(rootPage, /redirect\(['"]\/login['"]\)/, 'root page should redirect to /login')
