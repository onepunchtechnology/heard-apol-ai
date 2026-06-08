# Heard

**You sleep. It replies.**

Heard answers every review across your stores, in your brand voice — and only wakes you for the ones that matter.

Live at [heard.apol.ai](https://heard.apol.ai) · Built for the [Google for Startups AI Agents Challenge](https://devpost.team/google-cloud-for-startups/hackathons/3197), Track 1 · Part of [apol.ai](https://apol.ai)

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           Web App                                         │
│                 heard.apol.ai  (Next.js · Vercel)                        │
│        Setup · Reviews · Agents · Settings · Activity Dashboard           │
└──────────┬──────────────────────────────────────────┬────────────────────┘
           │ Supabase client SDK                      │ REST
           ▼                                          ▼
┌──────────────────────────────┐    ┌───────────────────────────────────────┐
│  Supabase  (Postgres)        │    │  Next.js API Routes  (Vercel)         │
│                              │    │                                       │
│  reviews                     │◄───│  POST  /api/webhooks/judgeme          │
│  review_actions              │    │  POST  /api/agent/trigger             │
│  stores                      │    │  POST  /api/reviews/[id]/approve      │
│  brand_voice_config          │    └──────────────────┬────────────────────┘
│  brand_voice_embeddings      │◄─────────────────────┐│ webhook
│    vector(768) · HNSW index  │                      │▼
│  RLS on every table          │                      │┌──────────────────┐
└──────────┬───────────────────┘                      ││  Judge.me        │
           │                                           ├│  Shopify         │
           │ reads / writes                            └│  Google Business │
           ▼                                            └──────────────────┘
┌──────────────────────────────────────────────────────────────────────────────┐
│                    Cloud Run Job  (heard-agent)                               │
│                    Python 3.12  ·  Google ADK ≥ 1.16                         │
│                                                                               │
│  Orchestrator  (deterministic — no LLM)                                      │
│  │                                                                            │
│  ├─ claim_review()  ← atomic UPDATE WHERE status = 'pending'                 │
│  │                                                                            │
│  ├─ ClassifierAgent  (ADK LlmAgent)  ─────────────────────► Gemini 2.5 Flash │
│  │   risk_score · sentiment · needs_order_context            via Vertex AI   │
│  │                                                                            │
│  ├─ Brand Voice RAG                                                           │
│  │   embed: text-embedding-004  ──────────────────────────► Vertex AI        │
│  │   search: match_brand_voice_replies()  pgvector cosine                    │
│  │   order: learned replies first  →  sample fills to 3  →  cold-start       │
│  │                                                                            │
│  ├─ DrafterAgent  (ADK LlmAgent)  ────────────────────────► Gemini 2.5 Flash │
│  │   grounded by RAG snippets  ·  two-tone brand voice       via Vertex AI   │
│  │   │                                                                        │
│  │   └─ fetch_order_context  ──► Shopify Admin MCP  ──► Shopify API 2026-01  │
│  │                               FastMCP · stdio subprocess                  │
│  │                                                                            │
│  ├─ Guardrails  (deterministic regex — LLM cannot override)                  │
│  │   refund_promise · replacement_offer · legal_threat · contact_info        │
│  │                                                                            │
│  └─ risk ≤ 3 + pass  →  auto_post      risk ≥ 4 or flag  →  needs_review    │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
           ▲                               │
           │  Cloud Scheduler              │  GOOGLE_GENAI_USE_VERTEXAI=TRUE
           │  sweep / 12h · 2am recovery   ▼
                                 ┌──────────────────────────────────────────┐
                                 │  Google Agent Platform  (Vertex AI)      │
                                 │  Gemini 2.5 Flash  ·  text-embedding-004 │
                                 │  Agent Platform Traces  (auto-captured)  │
                                 └──────────────────────────────────────────┘
```

---

## What it does

Multi-platform sellers burn time every morning answering reviews across multiple dashboards. Heard runs the overnight shift:

1. Pulls new reviews from every connected store
2. Classifies each: praise / question / complaint / urgent + risk score
3. Retrieves semantically matched brand voice examples via pgvector RAG
4. Drafts an on-brand reply grounded in your past replies and rules ("never promise refunds publicly")
5. Fetches Shopify order context on complaint reviews via MCP
6. Auto-posts the safe ones; escalates the risky ones with the order already pulled up

## Platforms

- **Judge.me** (Shopify review app) — webhook-driven, real-time
- **Google Business Profile** — poll-driven every 12h
- **Shopify Admin API** — order context on complaint reviews via MCP

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 14 App Router · TypeScript · Tailwind CSS · Vercel |
| Agent framework | Google ADK (Python 3.12) · Orchestrator + ClassifierAgent + DrafterAgent |
| AI model | Gemini 2.5 Flash via Google Agent Platform (Vertex AI) |
| RAG | pgvector on Supabase · `text-embedding-004` · `match_brand_voice_replies()` RPC |
| MCP | Custom Shopify Admin MCP Server (FastMCP · stdio · `McpToolset`) |
| Infrastructure | Cloud Run Job · Cloud Scheduler |
| Database | Supabase (Postgres + RLS + Realtime) |
| Observability | Google Agent Platform Traces (auto-captured) · in-app Agent Replay |
