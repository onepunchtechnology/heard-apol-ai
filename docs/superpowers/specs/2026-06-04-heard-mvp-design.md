# Heard MVP — Design Spec
**Date:** 2026-06-04
**Project:** heard.apol.ai — Autonomous review response agent
**Hackathon:** Google for Startups AI Agents Challenge, Track 1 (net-new agent)
**Deadline:** June 11, 2026, 5:00 PM PT
**Demo store:** OhayoPop (live multi-platform anime-merchandise store)

---

## Overview

Heard is an autonomous agent that reads customer reviews across connected storefronts, classifies and drafts on-brand replies, auto-posts safe ones, and escalates risky ones to the founder with the order already pulled up.

**v1 scope:** Shopify orders (context) + Judge.me reviews + Google Business Profile reviews. Webhook-driven for Judge.me, poll-driven for Google. Human-in-the-loop queue for anything the agent escalates.

**Google integration modes:** The Google Business Profile API requires a formal access request from Google (approval timeline: weeks to months). The app supports two modes so the demo is not blocked:
- **API mode** (connected): live OAuth, automated polling and reply posting.
- **Manual-paste mode** (fallback): agent still classifies and drafts; UI queues the reply and prompts the user to copy-paste it into the actual Google review link. OhayoPop's 20 existing Google reviews are seeded directly into the DB for the demo.

**Out of scope for v1:** TikTok Shop, eBay, Walmart, email/Slack briefing, analytics exports, multi-user/team accounts.

---

## Section 1: Architecture

### System Overview

Two services, one database.

```
Judge.me webhook
      │
      ▼
Next.js API route (Vercel)       ← validates HMAC, saves review, fires agent
      │
      ├── Supabase (shared DB)   ← single source of truth for both services
      │
      └── triggers Cloud Run Job ──► Python ADK Agent
                                         │
                                         ├── Shopify Admin API  (fetch order context)
                                         ├── Judge.me API       (post reply)
                                         ├── Google Business    (read + post reply)
                                         └── Gemini 2.0 Flash   (classify + draft)
                                         │
                                         └── writes results back to Supabase

Next.js UI (Vercel) ←─────────── reads from Supabase (Realtime + server components)
```

### Services

| Service | Tech | Host |
|---|---|---|
| Frontend + webhook receiver | Next.js 14 App Router, TypeScript, Tailwind | Vercel |
| Agent runtime | Python 3.12, Google ADK | Cloud Run Job |
| Scheduling | Cloud Scheduler | Google Cloud |
| Database | Supabase (Postgres + RLS + Realtime) | Supabase |
| AI model | Gemini 2.0 Flash | Google Cloud |

### Trigger Flow

**Judge.me (webhook-driven):**
1. Judge.me fires `review/created` webhook → hits `/api/webhooks/judgeme`
2. Next.js validates HMAC, returns 200 immediately, saves review to Supabase (`status: pending`)
3. Next.js calls Cloud Run Jobs API to create a new execution passing `review_id` + `store_id`
4. Agent runs, writes results back to Supabase
5. Dashboard reflects updated state via Supabase Realtime

**Google Business (poll-driven — no webhook support):**
1. Cloud Scheduler fires every 2 hours → triggers Cloud Run Job in `mode=sweep`
2. Agent fetches all reviews where `reviewReply == null` from Google Business Profile API
3. Processes each unresponded review

**Nightly recovery sweep:**
- Cloud Scheduler at 2am → full sweep of both platforms
- Catches any reviews stuck in `pending` or `processing` (missed webhooks, failed jobs)

---

## Section 2: Data Model

Five tables in Supabase. `reviews` holds raw ingest; `review_actions` holds all agent output.

### `stores`
```
id                          UUID PK
user_id                     UUID FK → auth.users
shop_domain                 TEXT        e.g. ohayopop.myshopify.com
shopify_access_token        TEXT        encrypted
judgeme_api_token           TEXT        encrypted
judgeme_oauth_client_id     TEXT        encrypted  (from Judge.me OAuth app)
judgeme_oauth_client_secret TEXT        encrypted  (from Judge.me OAuth app)
judgeme_webhook_secret      TEXT        encrypted  (HMAC secret from OAuth app — NOT the api_token)
google_oauth_tokens         JSONB       { access_token, refresh_token, expiry } — null if not connected
google_location_name        TEXT        e.g. accounts/123/locations/456
google_connection_mode      TEXT        api | manual_paste | null (not connected)
created_at                  TIMESTAMPTZ
```

### `brand_voice_config`
```
id                UUID PK
store_id          UUID FK → stores
sample_replies    TEXT[]      5–10 past reply examples pasted by the user
rules             TEXT[]      e.g. ["Never promise refunds publicly"]
tone_description  TEXT        optional freetext
updated_at        TIMESTAMPTZ
```

### `reviews`
```
id             UUID PK
store_id       UUID FK → stores
external_id    TEXT        Judge.me review ID or Google review name
source         TEXT        judgeme | google_business
reviewer_name  TEXT
rating         INT         1–5
title          TEXT
body           TEXT
product_title  TEXT
product_handle TEXT
order_id       TEXT        Shopify order ID (nullable)
status         TEXT        pending | processing | auto_posted | needs_review | reply_pending_manual | failed | approved | rejected
received_at    TIMESTAMPTZ
raw_payload    JSONB       full webhook/API payload for debugging
created_at     TIMESTAMPTZ

UNIQUE (external_id, store_id)
INDEX (store_id, status)
INDEX (store_id, received_at)
```

### `review_actions`
```
id               UUID PK
review_id        UUID FK → reviews  UNIQUE
sentiment_score  FLOAT       –1.0 to 1.0
sentiment_label  TEXT        positive | neutral | negative
category         TEXT        praise | question | complaint | urgent
risk_score       INT         0–10
risk_flags       TEXT[]      e.g. ["mentions refund", "wrong item"]
key_themes       TEXT[]      e.g. ["shipping", "product quality"]
agent_reasoning  TEXT        one sentence: why auto-posted or escalated
draft_reply      TEXT        what the agent wrote
final_reply      TEXT        what was actually posted (may differ if human edited)
order_context    JSONB       snapshot of Shopify order at processing time
auto_posted_at   TIMESTAMPTZ
reviewed_by      UUID FK → auth.users (nullable)
reviewed_at      TIMESTAMPTZ
created_at       TIMESTAMPTZ
```

### `agent_runs`
```
id                 UUID PK
store_id           UUID FK → stores
trigger_type       TEXT    webhook | manual | scheduled
review_ids         UUID[]
started_at         TIMESTAMPTZ
completed_at       TIMESTAMPTZ
reviews_processed  INT
auto_posted        INT
escalated          INT
failed             INT
error_details      JSONB
```

---

## Section 3: Integration Layer

### 3.1 Shopify Admin API

**Role:** Fetch order context per review. Read-only.

**Auth:** Shopify Private App access token. User generates in `Shopify Admin → Apps → Develop apps`. Stored encrypted in `stores.shopify_access_token`.

**What the agent fetches:**
- Customer first name
- Line items (product names, quantities)
- Fulfillment status + tracking number
- Order status (fulfilled, unfulfilled, cancelled)

**Endpoints:**
```
GET /admin/api/2024-01/orders/{order_id}.json
  → used when order_id is present in the review payload

GET /admin/api/2024-01/orders.json?email={email}
  → fallback when only reviewer email is available
```

**When called:** Only for complaint and urgent reviews, and only when an order_id or email is available. Not called on every review.

---

### 3.2 Judge.me API

**Role:** Receive new reviews via webhook; post public replies.

**Auth:** Two credentials required:
1. **Private API token** (`judgeme_api_token`) — for reading reviews via REST API. Found in `Judge.me Admin → Settings → Integrations → API`.
2. **OAuth app** — required for webhook HMAC verification. User creates an app at `Judge.me Partner Portal → Apps`. The app yields `client_id`, `client_secret`, and a **webhook secret** (separate from the API token). The `judgeme_webhook_secret` in `stores` is this OAuth-app webhook secret, not the API token.

**Webhook setup:**
- User creates an OAuth app in Judge.me partner portal
- Registers webhook URL `https://heard.apol.ai/api/webhooks/judgeme`, event: `review/created`
- Every request signed with `JUDGEME-HMAC-SHA256` header (derived from OAuth app webhook secret)
- Next.js validates signature using `stores.judgeme_webhook_secret`

**Webhook payload includes:** review ID, rating, body, reviewer name + email, product title + handle, Shopify order ID (when available).

**Reply endpoint** *(shape inferred from third-party integrations — verify against official docs before build):*
```
POST https://judge.me/api/v1/reviews/{id}/reply
Body: { shop_domain, api_token, reply: { body: "..." } }
```
Public replies appear immediately on the storefront widget.

---

### 3.3 Google Business Profile API

**Role:** Poll for unanswered reviews; post public replies (when in API mode).

**Access prerequisite:** The GBP API requires a formal access request submitted to Google before quota is granted. New GCP projects start with zero quota. Apply immediately at [Google Business Profile API access request form] — approval can take weeks and is not guaranteed before the June 11 demo. This is the reason the app supports two modes.

**Auth:** OAuth 2.0. User clicks "Connect Google Business" in setup, authorizes via consent screen.
- Scope: `https://www.googleapis.com/auth/business.manage`
- Tokens stored in `stores.google_oauth_tokens`
- Access tokens expire in 1 hour — agent refreshes automatically before every run

**Endpoints (API mode only):**
```
GET https://mybusinessreviews.googleapis.com/v1/{location_name}/reviews
  ?pageSize=50
  → filter client-side: reviewReply == null

PUT https://mybusinessreviews.googleapis.com/v1/{review_name}/reply
Body: { comment: "..." }
```

**Trigger:** Cloud Scheduler every 2 hours (no webhook support from Google).

#### Two operating modes

**API mode** (`google_connection_mode = 'api'`):
- Full automated flow: sweep fetches reviews, agent drafts, auto-posts low-risk replies
- Enabled when `google_oauth_tokens` is present and GBP API access is granted

**Manual-paste mode** (`google_connection_mode = 'manual_paste'`):
- Google reviews are seeded manually into the `reviews` table (for the demo: OhayoPop's ~20 existing Google reviews imported directly)
- Agent still classifies and drafts replies normally — full ADK reasoning applies
- `post_google_reply` tool is NOT called; decision is always `escalate` regardless of risk score
- UI queues the draft and shows a **"Copy & Post to Google"** action:
  - Copies draft reply to clipboard
  - Opens the direct Google review URL in a new tab
  - User pastes reply manually on Google
  - Clicking "Mark as posted" in the UI sets `status = approved` and records `final_reply`
- This mode shows the full agent capability (classification, brand voice, guardrails) without requiring live API access

**Mode transitions:**
- Default on setup: `null` (not connected)
- User clicks "Connect Google Business" and completes OAuth: set to `manual_paste` until API access confirmed
- User activates API mode manually in Settings after receiving Google API approval: set to `api`

### Trigger Summary

| Platform | Trigger | Latency | Handler |
|---|---|---|---|
| Judge.me | Webhook (review/created) | Seconds | `/api/webhooks/judgeme` → Cloud Run Job |
| Google Business | Cloud Scheduler (every 2h) | Up to 2h | Cloud Scheduler → Cloud Run Job |
| Nightly sweep | Cloud Scheduler (2am) | Overnight | Missed webhooks + full Google sweep |

---

## Section 4: ADK Agent

### 4.1 Entry Points

The Cloud Run Job runs in one of two modes, passed as an environment variable at trigger time:

- **`mode=single`** — triggered by Judge.me webhook. Receives `review_id`. Processes one review immediately.
- **`mode=sweep`** — triggered by Cloud Scheduler. In API mode: fetches all unanswered Google reviews via GBP API, upserts each into `reviews` table, then processes as a batch. Also catches any Judge.me reviews stuck in `pending`. In manual-paste mode: processes any seeded Google reviews still in `pending`.

### 4.2 Tools

Registered as ADK `FunctionTool` instances. The agent decides when to call each based on its reasoning — not a fixed sequence.

```
get_review_data(review_id)
  → reads review from Supabase

get_brand_voice(store_id)
  → reads sample_replies + rules + tone_description

get_order_context(order_id, store_id)
  → calls Shopify Admin API
  → returns: customer first name, line items, fulfillment, tracking
  → agent calls this only when it decides context is needed

get_google_reviews(store_id)
  → API mode only: calls Google Business Profile API
  → upserts each unresponded review into `reviews` table (source = google_business)
  → returns list of review_ids for processing
  → sweep mode only

post_judgeme_reply(review_id, reply_text, store_id)
  → calls Judge.me POST /reviews/{id}/reply  ⚠ endpoint shape unverified — confirm before build
  → posts public reply to storefront widget

post_google_reply(review_name, reply_text, store_id)
  → API mode: calls Google Business Profile PUT /{review_name}/reply
  → manual-paste mode: skips API call; sets review status to needs_review with reply_pending_manual flag
  → in both modes: saves draft_reply via save_review_action

save_review_action(review_id, action_data)
  → writes classification + draft + decision to Supabase
  → updates reviews.status
```

### 4.3 Why ADK — The Concrete Difference

A pipeline calls tools in a fixed order with one LLM pass. The ADK agent reasons dynamically about which tools to call, in what order, based on what it discovers at each step.

**Example — 2-star review, "box arrived crushed, wrong color":**

Pipeline: classify → draft → check guardrails → escalate. Generic draft because no order data.

ADK agent:
1. Reads review. Sees complaint + wrong item claim. Decides: "I need order context before drafting."
2. Calls `get_order_context` → fulfillment shows correct item shipped, carrier issue.
3. Drafts reply acknowledging carrier damage, avoids implying a picker error.
4. Guardrail scan → draft mentions "send you a replacement" → fires, blocks auto-post.
5. Revises draft, removes commitment. Risk score 8 → escalates.
6. Saves reasoning: "Carrier damage confirmed by fulfillment. Replacement language removed by guardrail. Escalated risk 8."

The human sees the draft and the order already pulled up. The reasoning trace (steps 1–6) is the demo's triage log beat at 0:22–0:55.

### 4.4 System Prompt Structure

Built dynamically per store at runtime, injecting that store's brand voice and rules:

```
You are Heard, an autonomous review response agent for {shop_name}.

Your goal: process each review and either post a reply autonomously
or escalate to the owner — applying their rules, in their voice.

BRAND VOICE
Tone: {tone_description}
Example replies from this store:
{sample_replies[0..4]}

RULES (never violate these)
{rules}

CLASSIFICATION
Assign each review:
- category: praise | question | complaint | urgent
- sentiment_score: -1.0 to 1.0
- sentiment_label: positive | neutral | negative
- risk_score: 0–10 (rubric below)
- risk_flags: specific triggers found in the review text
- key_themes: e.g. ["shipping", "product quality"]

RISK RUBRIC
Base: (5 - rating) × 1.5
+4 if mentions refund / compensation / money back
+3 if mentions wrong item / damaged / broken
+4 if mentions never arrived / lost in transit
+3 if tone is hostile or threatening
+5 if legal language (lawsuit, BBB, report to Google)

DECISION
risk_score 0–3  → draft reply, call post_reply tool
risk_score 4+   → draft reply, escalate (do NOT post)

Always fetch order context before drafting a complaint or urgent review.
Keep replies under 300 chars for Google, 500 chars for Judge.me.
Use the customer's first name. Reference the specific product.
```

### 4.5 Guardrails — Deterministic Layer

Runs after the LLM drafts, before any post call. Hardcoded string checks — not LLM-based. The agent cannot override these.

```python
ESCALATION_TRIGGERS = [
    r"refund",
    r"replacement",
    r"send you a new",
    r"compensate",
    r"money back",
    r"i['']ll make it right",
    r"\$\d+",       # any dollar amount
]

def apply_guardrails(draft: str) -> GuardrailResult:
    for pattern in ESCALATION_TRIGGERS:
        if re.search(pattern, draft, re.IGNORECASE):
            return GuardrailResult(violated=True, reason=f"Draft contains: '{pattern}'")
    return GuardrailResult(violated=False)
```

If a guardrail fires, `risk_score` is forced to 8 and the review escalates regardless of the LLM's classification. Logged in `agent_reasoning`.

### 4.6 Structured Output Schema

The agent produces this before calling any post or save tool:

```python
class ReviewAction(BaseModel):
    category: Literal["praise", "question", "complaint", "urgent"]
    sentiment_score: float          # -1.0 to 1.0
    sentiment_label: Literal["positive", "neutral", "negative"]
    risk_score: int                 # 0–10
    risk_flags: list[str]
    key_themes: list[str]
    draft_reply: str
    decision: Literal["auto_post", "escalate"]
    reasoning: str                  # one sentence
    needs_order_context: bool       # agent declares before fetching
```

### 4.7 Error Handling

| Failure | Behaviour |
|---|---|
| Shopify API unreachable | Proceed without order context. Note in reasoning. |
| Reply API fails (Judge.me or Google) | Do not retry. Set `needs_review`. Log error. |
| Gemini fails | Retry once after 5s. If still fails, set `failed`. |
| Gemini returns malformed output | Force escalate. Log raw response. |
| Guardrail fires | Force escalate. Never auto-post. |
| Review already processed | `external_id` unique constraint skips silently. |

---

## Section 5: Next.js UI

### 5.1 Routes

```
/login                              Supabase magic link auth
/setup                              Onboarding wizard (runs once)
/dashboard                          Analytics + review queue + activity feed
/settings                           Store settings + integration status + API mode toggle
/api/webhooks/judgeme               Webhook receiver
/api/agent/trigger                  Manual trigger (testing + demo)
/api/reviews/[id]/approve           Post reply to platform + update status (Judge.me and Google API mode)
/api/reviews/[id]/mark-posted       Mark reply as manually posted (Google manual-paste mode only)
/api/reviews/[id]/reject            Update status, no reply posted
/api/auth/google/callback           Google OAuth callback
```

### 5.2 Setup Flow — 4 Steps

**Step 1 — Connect Shopify**
- Input: shop domain
- Input: Shopify Private App access token
- "Test connection" validates credentials via Shopify orders API

**Step 2 — Connect Judge.me**
- Shop domain pre-filled
- Input: Judge.me Private API Token
- "Test connection" calls `GET /api/v1/reviews` to validate
- After save: inline instructions to create a Judge.me OAuth app:
  1. Go to `Judge.me Partner Portal → Apps → Create App`
  2. Copy Client ID, Client Secret, and Webhook Secret into Heard settings
  3. In the OAuth app, register webhook URL `https://heard.apol.ai/api/webhooks/judgeme`, event: `review/created`
- Saves all four Judge.me credentials (`api_token`, `oauth_client_id`, `oauth_client_secret`, `webhook_secret`)

**Step 3 — Connect Google Business**
- "Connect Google Business" button → Google OAuth consent flow
- On callback: fetches location(s), auto-selects if one, shows picker if multiple
- Saves `google_location_name` + OAuth tokens
- Sets `google_connection_mode = 'manual_paste'` (default; user upgrades to `api` mode in Settings after Google approves API access)
- Shows inline notice: *"Google Business is connected in manual-paste mode. The agent will draft replies and queue them for you to post. To enable automatic posting, request Google Business Profile API access and activate API mode in Settings."*

**Step 4 — Train Brand Voice**
- Textarea: paste 5–10 past review replies (one per line)
- Rules (pre-populated, editable):
  - "Never promise refunds or replacements publicly"
  - "Always address the customer by first name"
  - "Always thank them for leaving a review"
  - "+ Add your own rule" button
- Tone description (optional freetext)
- Save → redirect to `/dashboard`

### 5.3 Dashboard

**Metrics Bar** — always visible across top:

```
Reviews (30d)  |  Auto-handled  |  Avg sentiment  |  Time saved  |  Judge.me  |  Google
     47        |     78%        |    +0.62  ↑     |   ~2.3 hrs   |     31     |    16
```

Below: 14-day sentiment trend (line chart) + category breakdown donut (Recharts).

**Review Queue** — all `needs_review` reviews, sorted: urgent → highest risk score → oldest first.

Each card shows:
- Platform badge (Judge.me / Google)
- Star rating + reviewer name + product
- Full review text
- Risk flags + risk score
- Order context snippet (when available): `Order #4821 · Unfulfilled · Last tracked Nov 28`
- Editable draft reply textarea
- Expandable agent reasoning
- Actions (vary by platform + mode):

**Judge.me reviews:** [Approve] [Edit & Approve] [Skip]
- Approve posts draft via `/api/reviews/[id]/approve` → calls Judge.me reply API
- Edit & Approve lets user modify draft first, then posts

**Google reviews — API mode:** same as Judge.me [Approve] [Edit & Approve] [Skip]
- Posts via `/api/reviews/[id]/approve` → calls Google Business Profile reply API

**Google reviews — manual-paste mode:** [Copy & Post to Google] [Skip]
- "Copy & Post to Google" button:
  1. Copies approved reply text to clipboard
  2. Opens the Google review URL in a new tab (direct link to the review on Google Maps)
  3. Shows inline confirmation: *"Did you post it? [Mark as Posted]"*
- "Mark as Posted" calls `/api/reviews/[id]/mark-posted` → sets `status = approved`, saves `final_reply`
- Platform badge shows "Google (manual)" to distinguish from API mode

**Activity Feed** — right sidebar, Supabase Realtime:
```
Heard replied to Yuki T. on Google              2h ago   ★★★★★
Heard replied to Sam K. on Judge.me             3h ago   ★★★★☆
Heard escalated Kenji T. to your queue          3h ago   ★★☆☆☆
```

### 5.4 Webhook Receiver — `/api/webhooks/judgeme`

1. Validate `JUDGEME-HMAC-SHA256` header → return 401 if invalid
2. Return HTTP 200 immediately (before any processing)
3. Async: upsert review to Supabase (skip on `external_id` conflict)
4. Async: call Cloud Run Jobs API to create execution with `review_id` + `store_id`

### 5.5 Component Split

| Component | Type | Reason |
|---|---|---|
| Dashboard metrics bar | Server Component | Static aggregation, no interactivity |
| Sentiment / category charts | Client Component | Recharts requires browser |
| Review queue cards | Client Component | Approve/edit/reject interactions |
| Activity feed | Client Component | Supabase Realtime subscription |
| Setup wizard | Client Component | Multi-step form state |

---

## Section 6: Error Handling + Reliability

### 6.1 Review Status as Safety Net

Full lifecycle:
```
pending → processing → auto_posted                    (Judge.me or Google API mode, low-risk)
                    ↘ needs_review                    (escalated by agent — human must act)
                    ↘ reply_pending_manual            (Google manual-paste mode — agent drafted, user copies and posts)
                    ↘ failed                          (agent crashed, couldn't even save)
                              ↓
                        approved | rejected           (human acted: approved or skipped)
```

`processing` is set at the very start of the Cloud Run Job. Prevents double-processing in sweep mode. Reviews stuck in `processing` for > 30 minutes are reset to `pending` by the nightly sweep.

### 6.2 Fail-Safe Escalation

Any unhandled exception defaults to `needs_review`, never silent failure. `failed` is reserved for cases where even writing to the queue failed.

```python
try:
    result = await agent.process(review)
except GeminiError:
    # retry once, then escalate
except ShopifyAPIError:
    # proceed without order context, escalate
except Exception:
    # catch-all → escalate
finally:
    if result is None:
        set_status(review_id, 'needs_review', reasoning="Agent error — needs manual review")
```

### 6.3 Webhook Reliability

- **Duplicate protection:** `external_id + store_id` unique constraint silently skips retries
- **Timing:** HTTP 200 returned before triggering Cloud Run Job — never blocks on processing
- **HMAC failure:** Returns 401, logs attempt, no record created
- **Recovery:** Nightly sweep at 2am catches any reviews stuck in `pending`

### 6.4 External API Failure Matrix

| API | Failure | Behaviour |
|---|---|---|
| Shopify | 4xx / 5xx | Proceed without order context. Note in `agent_reasoning`. |
| Shopify | 429 rate limit | Wait 500ms, retry once. |
| Judge.me reply | Fails | Escalate to `needs_review`. Log error. No retry. |
| Google reply | Fails | Escalate to `needs_review`. Log error. No retry. |
| Google OAuth | Token expired | Auto-refresh using stored refresh token before each run. |
| Google OAuth | Refresh fails (revoked) | Mark integration `disconnected`. Show dashboard warning. |
| Gemini | 429 | Exponential backoff: 1s → 2s → 4s. Max 3 retries. |
| Gemini | Malformed output | Force escalate. Log raw response. |

### 6.5 Reply Deduplication

Before posting any reply:
- Judge.me: check `review_actions.auto_posted_at` is null for this review
- Google: check `reviewReply` field in fetched review payload is null

Prevents double-posting if agent runs twice against the same review.

### 6.6 Cloud Run Job Limits

| Mode | Timeout | Notes |
|---|---|---|
| Single review (webhook) | 5 minutes | One Gemini call + 2–3 API calls |
| Sweep (Google + missed) | 15 minutes | Up to ~50 reviews, sequential |

### 6.7 Dashboard Failure Visibility

- `failed` reviews surface in a dedicated section above the main queue
- Google integration disconnected → yellow warning banner with "Reconnect Google" button
- `agent_runs` with `failed > 0` shown in activity feed with error indicator

---

## Submission Checklist

- [ ] Code (this repo: `heard-apol-ai`)
- [ ] Video (≤ 2.5 min, per storyboard in project brief)
- [ ] Architecture diagram
- [ ] Testing access — `heard.apol.ai` with demo login
- [ ] Submit before June 11, 2026, 5:00 PM PT

## Open Questions / Risks

- **[APPLY TODAY] Google Business Profile API access** — formal access request required from Google. Approval timeline: weeks to months, high denial/delay rate. Submit immediately. Demo fallback is manual-paste mode with seeded OhayoPop reviews. If access arrives before June 11, toggle to API mode.
- **Judge.me reply endpoint shape** — `POST /api/v1/reviews/{id}/reply` is inferred from third-party integrations. Verify against official Judge.me API docs or support before building the reply tool.
- **Judge.me OAuth app on OhayoPop plan** — confirm partner portal access and webhook registration are available on OhayoPop's current Judge.me plan.
- **Google review URLs for manual-paste** — the direct link to a specific Google review (for the "Copy & Post" flow) needs to be derivable from the `review_name` field returned by the GBP API. Confirm URL format before building.
- Lock brand voice samples from OhayoPop's existing Judge.me replies before building voice training step
- Seed OhayoPop's ~20 Google reviews into the DB as part of demo setup (script needed)
- Verify "Heard" name trademark before any public launch
