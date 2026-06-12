import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const read = (path) => readFileSync(path, 'utf8')

assert.ok(
  existsSync('lib/agent-status.ts'),
  'agent status state machine should live in a focused helper'
)
assert.ok(
  existsSync('components/ui/AgentStatusProvider.tsx'),
  'AgentStatusProvider should exist'
)
assert.ok(
  existsSync('components/ui/AgentStatusPill.tsx'),
  'AgentStatusPill should exist'
)

const css = read('app/globals.css')
assert.match(css, /@keyframes agent-blink/, 'globals should define agent-blink keyframes')
assert.match(css, /@keyframes agent-pulse-ring/, 'globals should define agent-pulse-ring keyframes')
assert.match(css, /\.agent-blink/, 'globals should expose agent-blink utility')
assert.match(css, /\.agent-pulse-ring::after/, 'globals should expose agent-pulse-ring utility')
assert.match(css, /--color-agent-dot:/, 'globals should define an agent dot color token')
assert.match(css, /--color-agent-border-rest:/, 'globals should define an agent rest border token')
assert.match(css, /--color-agent-border-active:/, 'globals should define an agent active border token')
assert.match(css, /--color-agent-text:/, 'globals should define an agent text color token')
assert.match(
  css,
  /\.agent-pulse-ring::after[\s\S]*background:\s*var\(--color-agent-dot\)/,
  'agent pulse ring should use the agent dot color token'
)
assert.match(
  css,
  /prefers-reduced-motion:\s*reduce[\s\S]*\.agent-blink[\s\S]*\.agent-pulse-ring::after[\s\S]*animation:\s*none/,
  'agent animations should respect reduced motion'
)

const logic = read('lib/agent-status.ts')
const transpiledLogic = ts.transpileModule(logic, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText
const sandbox = { exports: {}, module: { exports: {} } }
sandbox.module.exports = sandbox.exports
vm.runInNewContext(transpiledLogic, sandbox)
const { deriveStatus } = sandbox.module.exports
assert.equal(deriveStatus(0, false), 'listening', 'no pending or processing reviews should listen')
assert.equal(deriveStatus(1, false), 'reading', 'pending or processing reviews without drafts should read')
assert.equal(deriveStatus(1, true), 'drafting', 'active reviews with a draft should draft')
assert.equal(deriveStatus(0, true), 'listening', 'finished sweeps should reset to listening even if a draft was seen')

const provider = read('components/ui/AgentStatusProvider.tsx')
assert.match(provider, /createContext<AgentStatus>\('listening'\)/, 'provider should default to listening')
assert.match(
  provider,
  /\.from\('reviews'\)[\s\S]*\.in\('status', \['pending', 'processing'\]\)/,
  'provider should count pending and processing reviews'
)
assert.match(provider, /table: 'reviews'/, 'provider should subscribe to reviews changes')
assert.match(provider, /table: 'review_actions'/, 'provider should subscribe to review_actions inserts')
assert.match(provider, /status === 'SUBSCRIBED'/, 'provider should resync when the realtime channel reconnects')
assert.match(provider, /removeChannel\(channel\)/, 'provider should clean up the realtime channel')

const pill = read('components/ui/AgentStatusPill.tsx')
assert.match(pill, /useAgentStatus/, 'pill should read status from provider')
assert.match(pill, /role="status"/, 'pill should announce status accessibly')
assert.match(pill, /aria-live="polite"/, 'pill should use polite live region')
assert.match(pill, /agent-blink/, 'pill should blink while reading')
assert.match(pill, /agent-pulse-ring/, 'pill should pulse while drafting')
assert.match(pill, /bg-\[var\(--color-bg\)\]/, 'pill background should use the bg token')
assert.match(pill, /bg-\[var\(--color-agent-dot\)\]/, 'pill dot should use the agent dot token')
assert.match(pill, /text-\[var\(--color-agent-text\)\]/, 'pill label should use the agent text token')
assert.doesNotMatch(pill, /#[0-9A-Fa-f]{6}/, 'pill should not hardcode color hex values')

const navItem = read('components/ui/NavItem.tsx')
assert.match(navItem, /rounded-lg/, 'nav items should use rounded active and hover states')
assert.match(navItem, /bg-surface-2 font-medium text-text/, 'active nav item should use soft selected background')
assert.match(navItem, /font-normal text-muted hover:bg-surface/, 'inactive nav item should be muted with hover background')
assert.doesNotMatch(navItem, /border-l-\[3px\]/, 'active nav item should not use a left border')

const layout = read('app/dashboard/layout.tsx')
assert.match(layout, /AgentStatusProvider/, 'dashboard layout should import/use AgentStatusProvider')
assert.match(layout, /AgentStatusPill/, 'dashboard layout should import/use AgentStatusPill')
assert.match(layout, /<AgentStatusProvider>[\s\S]*<nav/, 'provider should wrap sidebar content including nav')
assert.match(layout, /<AgentStatusPill \/>/, 'layout should render desktop status pill')
assert.match(layout, /<AgentStatusPill size="compact" className="md:hidden" \/>/, 'layout should render compact mobile status pill')

const activityClient = read('app/dashboard/ActivityClient.tsx')
assert.doesNotMatch(activityClient, /storeCount/, 'ActivityClient should not accept or render storeCount')
assert.doesNotMatch(activityClient, /always on/, 'ActivityClient should not render the old always-on status bar')
assert.match(activityClient, /last reply \{formatDistanceToNow\(lastRunAt\)\} ago/, 'ActivityClient should preserve the last reply timestamp')

const dashboardPage = read('app/dashboard/page.tsx')
assert.doesNotMatch(dashboardPage, /storeCount/, 'dashboard page should not fetch or pass storeCount')
