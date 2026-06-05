# Heard — CLAUDE.md

## Project Overview

Heard is an autonomous review-response agent that reads, classifies, and replies to customer reviews across connected storefronts in the merchant's brand voice.

- **App URL:** `heard.apol.ai`
- **Hackathon:** Google for Startups AI Agents Challenge, Track 1, deadline June 11 2026
- **Demo store:** OhayoPop (live anime-merchandise store)

## Stack

| Layer | Tech |
|---|---|
| Frontend + webhooks | Next.js 14 App Router, TypeScript, Tailwind CSS |
| Agent runtime | Python 3.12, Google ADK |
| Scheduling | Google Cloud Scheduler |
| Database | Supabase (Postgres + RLS + Realtime) |
| AI model | Gemini 2.0 Flash |
| Hosting | Vercel (Next.js), Cloud Run Jobs (agent) |

## Project Structure

```
heard-apol-ai/
├── app/                    Next.js App Router
│   ├── (auth)/login/
│   ├── setup/
│   ├── dashboard/
│   ├── settings/
│   └── api/
│       ├── webhooks/judgeme/
│       ├── agent/trigger/
│       ├── reviews/[id]/approve/
│       ├── reviews/[id]/mark-posted/
│       ├── reviews/[id]/reject/
│       └── auth/google/callback/
├── agent/                  Python ADK agent (Cloud Run Job)
│   ├── main.py
│   ├── tools/
│   └── guardrails.py
├── lib/                    Shared TypeScript utilities
├── supabase/               Migrations + seed data
└── docs/
    └── superpowers/specs/  Design specs
```

## Design Spec

Full MVP design: `docs/superpowers/specs/2026-06-04-heard-mvp-design.md`

## Key Constraints

- Deadline is June 11 2026, 5:00 PM PT — ship fast, no scope creep
- Demo on OhayoPop (real store); demo must be live-safe
- Google Business Profile API requires formal access request — app must work in manual-paste mode as fallback
- Guardrails are deterministic (regex), not LLM-based — agent cannot override them

## Credentials Pattern

All store credentials stored encrypted in Supabase `stores` table. Never log or expose:
- `shopify_access_token`
- `judgeme_api_token`, `judgeme_oauth_client_id`, `judgeme_oauth_client_secret`, `judgeme_webhook_secret`
- `google_oauth_tokens`

Use `sb_publishable_...` Supabase keys client-side, `sb_secret_...` server-side only. Never use legacy `eyJ...` JWT keys.

## GitHub

Repo: `onepunchtechnology/heard-apol-ai` (private)
Switch to `gh auth switch --user onepunchtechnology` before any `gh` or `git push` operations.

## GCP

Always use explicit `--project heard-apol-ai` flag on every `gcloud` command.

## Code Style

- ES modules (`import/export`), never CommonJS
- Destructure imports where possible
- No comments unless the WHY is non-obvious
- No trailing summary paragraphs in responses
