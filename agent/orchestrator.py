import os
from datetime import datetime, timezone

import httpx
from google import genai as _genai
from supabase import create_client, Client

from agents.classifier import ClassifierAgent
from agents.drafter import DrafterAgent
from guardrails import check as guardrails_check

_genai_client = _genai.Client()

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

AUTO_POST_MAX_RISK = 3
JUDGEME_API_BASE = "https://api.judge.me/api/v1"


def should_auto_post(risk_score: int, guardrails_passed: bool) -> bool:
    return risk_score <= AUTO_POST_MAX_RISK and guardrails_passed


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _step(name: str, status: str, **extra) -> dict:
    return {"step": name, "status": status, "at": _now(), **extra}


def _dedupe(values: list[str]) -> list[str]:
    seen: set[str] = set()
    deduped: list[str] = []
    for value in values:
        text = value.strip()
        if not text or text in seen:
            continue
        seen.add(text)
        deduped.append(text)
    return deduped


class Orchestrator:
    def __init__(self) -> None:
        self._db: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        self._classifier = ClassifierAgent()
        self._drafter = DrafterAgent()

    async def sweep(self) -> None:
        result = (
            self._db.table("reviews")
            .select("id")
            .eq("status", "pending")
            .order("received_at", desc=False)
            .limit(50)
            .execute()
        )
        ids = [row["id"] for row in (result.data or [])]
        if not ids:
            print("[sweep] no pending reviews")
            return

        print(f"[sweep] found {len(ids)} pending reviews")
        for review_id in ids:
            try:
                await self.process_review(review_id)
            except Exception as exc:  # noqa: BLE001
                print(f"[sweep] error processing {review_id}: {exc}")

    async def process_review(self, review_id: str) -> None:
        trace: list[dict] = []

        # --- 1. Atomic claim: exit immediately if another process already claimed it ---
        claim = self._db.rpc("claim_review", {"p_review_id": review_id}).execute()
        if not claim.data:
            print(f"[{review_id}] already claimed or not pending — skip")
            return
        trace.append(_step("claim", "complete"))

        # --- 2. Load review + store credentials ---
        row = (
            self._db.table("reviews")
            .select("*, stores(shopify_domain, platform_access_token, judgeme_api_token, reply_mode)")
            .eq("id", review_id)
            .single()
            .execute()
        ).data
        if not row:
            return

        store = row.get("stores") or {}

        # --- 3. Load brand voice ---
        bv = (
            self._db.table("brand_voice_config")
            .select("*")
            .eq("store_id", row["store_id"])
            .maybe_single()
            .execute()
        ).data

        # --- 4. Classify ---
        try:
            classification = await self._classifier.classify(
                reviewer_name=row.get("reviewer_name", ""),
                rating=row.get("rating", 3),
                body=row.get("body", ""),
                source=row.get("source", ""),
            )
            trace.append(_step("classify", "complete", result=classification))
        except Exception as exc:
            trace.append(_step("classify", "failed", error=str(exc)))
            self._save_action(review_id, 9, "neutral", str(exc), None, 0, None, [], {"steps": trace})
            self._set_status(review_id, "needs_review")
            return

        risk_score: int = int(classification.get("risk_score", 5))
        sentiment: str = classification.get("sentiment_label", "neutral")
        reasoning: str = classification.get("agent_reasoning", "")

        # --- 5. Brand Voice RAG — pgvector semantic match, array-slice fallback ---
        rag_snippets: list[str] = []
        rag_learned_count = 0
        rag_scores: list[float] = []
        rag_method = "fallback"

        if bv:
            await self._seed_embeddings_if_needed(row["store_id"], bv)
            review_text = f"{row.get('title', '')} {row.get('body', '')}".strip()
            query_embedding = await self._embed_text(review_text)

            if query_embedding:
                # Source-first: learned replies take priority, sample fills remaining slots
                learned_matches = await self._semantic_match(row["store_id"], query_embedding, "learned", 3)
                rag_snippets = [t for t, _ in learned_matches]
                rag_scores = [s for _, s in learned_matches]
                rag_learned_count = len(rag_snippets)

                remaining = 3 - len(rag_snippets)
                if remaining > 0:
                    sample_matches = await self._semantic_match(row["store_id"], query_embedding, "sample", remaining)
                    rag_snippets += [t for t, _ in sample_matches]
                    rag_scores += [s for _, s in sample_matches]

                if rag_snippets:
                    rag_method = "pgvector"

            # Fallback: no embeddings yet or embed API failed
            if not rag_snippets:
                learned_arr = (bv.get("learned_replies") or [])[:3]
                ai_samples = bv.get("sample_replies") or []
                needed = max(0, 3 - len(learned_arr))
                rag_snippets = learned_arr + ai_samples[:needed]
                rag_learned_count = len(learned_arr)

                # Cold start: nothing at all — generate from tone descriptions
                if not rag_snippets and (bv.get("tone_positive") or bv.get("tone_negative")):
                    generated = await self._generate_cold_start_samples(bv, row["store_id"])
                    rag_snippets = generated[:3]
                    for sample in generated:
                        sample_emb = await self._embed_text(sample)
                        if sample_emb:
                            self._store_embedding(row["store_id"], sample, sample_emb, "sample")

        trace.append(_step(
            "brand_voice_rag", "complete",
            method=rag_method,
            matched_count=len(rag_snippets),
            real_reply_count=rag_learned_count,
            ai_sample_count=len(rag_snippets) - rag_learned_count,
            similarity_scores=[round(s, 3) for s in rag_scores] if rag_scores else None,
            snippets=[s[:60] for s in rag_snippets],
        ))

        # Inject semantically matched snippets so the drafter reads them from brand_voice.sample_replies
        bv = {**(bv or {}), "sample_replies": rag_snippets}

        # --- 6. Draft — DrafterAgent calls Shopify MCP for order context when needed ---
        try:
            draft_result = await self._drafter.draft(
                review=row,
                classification=classification,
                brand_voice=bv,
                shop_domain=store.get("shopify_domain"),
                access_token=store.get("platform_access_token"),
            )
            trace.append(_step("draft", "complete", confidence=draft_result.get("confidence")))
        except Exception as exc:
            trace.append(_step("draft", "failed", error=str(exc)))
            self._save_action(review_id, risk_score, sentiment, reasoning, None, 0, None, [], {"steps": trace})
            self._set_status(review_id, "needs_review")
            return

        draft_reply: str = draft_result.get("draft_reply", "")
        confidence: int = int(draft_result.get("confidence", 50) or 50)
        order_context: dict | None = draft_result.get("order_context") or None

        # --- 7. Guardrails ---
        gr = guardrails_check(draft_reply)
        trace.append(_step(
            "guardrails",
            "complete" if gr.passed else "warning",
            passed=gr.passed,
            fired_flags=gr.fired_flags,
        ))

        # --- 8. Persist action record ---
        self._save_action(
            review_id, risk_score, sentiment, reasoning,
            draft_reply, confidence, order_context, gr.fired_flags,
            {"steps": trace},
        )

        # --- 9. Auto-post or escalate ---
        reply_mode: str = store.get("reply_mode") or "manual_approval"
        would_auto_post = should_auto_post(risk_score, gr.passed)
        decision = "auto_post" if would_auto_post else "escalate"
        self._write_decision(review_id, decision)

        if reply_mode == "manual_approval":
            # Always hold for human review — route by source so the UI shows the right action
            target_status = "needs_review" if row.get("source") == "judgeme" else "reply_pending_manual"
            self._set_status(review_id, target_status)
            print(f"[{review_id}] manual_approval mode → {target_status}")
        elif would_auto_post:
            await self._auto_post(review_id, row, store, draft_reply, trace)
        else:
            self._set_status(review_id, "needs_review")
            reason = f"risk={risk_score}" if risk_score > AUTO_POST_MAX_RISK else f"guardrails={gr.fired_flags}"
            print(f"[{review_id}] escalated ({reason})")

    async def _auto_post(
        self, review_id: str, row: dict, store: dict, draft_reply: str, trace: list
    ) -> None:
        posted = False
        if row.get("source") == "judgeme" and store.get("judgeme_api_token") and row.get("external_id"):
            try:
                async with httpx.AsyncClient(timeout=15.0) as client:
                    resp = await client.post(
                        f"{JUDGEME_API_BASE}/replies",
                        params={"shop_domain": store.get("shopify_domain", "")},
                        headers={"X-Api-Token": store["judgeme_api_token"]},
                        json={
                            "review_id": int(row["external_id"]),
                            "reply": {"content": draft_reply},
                        },
                    )
                    posted = resp.status_code in (200, 201)
            except Exception as exc:
                trace.append(_step("post", "failed", error=str(exc)))

        if posted:
            self._db.table("review_actions").update({"final_reply": draft_reply}).eq("review_id", review_id).execute()
            self._set_status(review_id, "auto_posted")
            trace.append(_step("post", "complete"))
            print(f"[{review_id}] auto_posted")
            await self._add_learned_reply(row["store_id"], draft_reply)
        else:
            self._set_status(review_id, "reply_pending_manual")
            trace.append(_step("post", "warning", reason="post_failed_or_unsupported_source"))
            print(f"[{review_id}] auto_post failed → reply_pending_manual")

    async def _generate_cold_start_samples(self, bv: dict, store_id: str) -> list[str]:
        """Generate 3 synthetic brand voice sample replies when no real examples exist yet."""
        tone_pos = bv.get("tone_positive") or bv.get("tone_description") or "warm and friendly"
        tone_neg = bv.get("tone_negative") or bv.get("tone_description") or "empathetic and solution-focused"
        prompt = (
            "You are a brand voice consultant. An e-commerce store needs sample reply templates "
            "to ground an AI reply agent in their voice.\n\n"
            f"Positive review tone: {tone_pos}\n"
            f"Complaint/negative review tone: {tone_neg}\n\n"
            "Write exactly 3 sample replies this store might send:\n"
            "1. A reply to a delighted 5-star review\n"
            "2. A reply to a 4-star review with one mild concern\n"
            "3. A reply to a frustrated 1-2 star complaint\n\n"
            "Rules: each reply under 120 words, no placeholders, no markdown, genuine brand voice.\n"
            "Format: return only the 3 reply texts separated by the exact string '---' on its own line. "
            "No numbering, no labels."
        )
        try:
            response = await _genai_client.aio.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt,
            )
            samples = [s.strip() for s in (response.text or "").split("---") if s.strip()][:3]
            if samples:
                self._db.table("brand_voice_config").update(
                    {"sample_replies": samples}
                ).eq("store_id", store_id).execute()
                print(f"[brand_voice_rag] cold start: generated {len(samples)} samples for store {store_id}")
            return samples
        except Exception as exc:
            print(f"[brand_voice_rag] cold start generation failed: {exc}")
            return []

    # ------------------------------------------------------------------ RAG helpers

    async def _embed_text(self, text: str) -> list[float] | None:
        try:
            result = await _genai_client.aio.models.embed_content(
                model="text-embedding-004",
                contents=text,
            )
            return list(result.embeddings[0].values)
        except Exception as exc:
            print(f"[rag] embed failed: {exc}")
            return None

    def _store_embedding(self, store_id: str, reply_text: str, embedding: list[float], source: str) -> None:
        try:
            self._db.table("brand_voice_embeddings").upsert(
                {
                    "store_id": store_id,
                    "reply_text": reply_text,
                    "embedding": embedding,
                    "source": source,
                },
                on_conflict="store_id,reply_text",
            ).execute()
        except Exception as exc:
            print(f"[rag] store_embedding failed: {exc}")

    async def _semantic_match(
        self,
        store_id: str,
        query_embedding: list[float],
        source: str,
        limit: int,
    ) -> list[tuple[str, float]]:
        try:
            result = self._db.rpc("match_brand_voice_replies", {
                "p_store_id": store_id,
                "p_query_embedding": query_embedding,
                "p_source": source,
                "p_limit": limit,
            }).execute()
            return [(row["reply_text"], float(row["similarity"])) for row in (result.data or [])]
        except Exception as exc:
            print(f"[rag] semantic_match failed (source={source}): {exc}")
            return []

    async def _seed_embeddings_if_needed(self, store_id: str, bv: dict) -> None:
        """Lazy seed missing historical and configured replies into brand voice embeddings."""
        existing: set[str] = set()
        try:
            response = (
                self._db.table("brand_voice_embeddings")
                .select("reply_text")
                .eq("store_id", store_id)
                .execute()
            )
        except Exception:
            response = None

        if response:
            existing = {row["reply_text"] for row in (response.data or []) if row.get("reply_text")}

        learned_replies = self._load_imported_final_replies(store_id) + (bv.get("learned_replies") or [])
        sample_replies = bv.get("sample_replies") or []

        seeded = 0
        for reply in _dedupe(learned_replies):
            if reply in existing:
                continue
            emb = await self._embed_text(reply)
            if emb:
                self._store_embedding(store_id, reply, emb, "learned")
                seeded += 1
        for reply in _dedupe(sample_replies):
            if reply in existing:
                continue
            emb = await self._embed_text(reply)
            if emb:
                self._store_embedding(store_id, reply, emb, "sample")
                seeded += 1
        if seeded:
            print(f"[rag] seeded {seeded} embeddings for store {store_id}")

    def _load_imported_final_replies(self, store_id: str) -> list[str]:
        """Load historical merchant replies that should ground future drafts."""
        try:
            result = (
                self._db.table("review_actions")
                .select("final_reply, reviews!inner(status, store_id)")
                .eq("reviews.store_id", store_id)
                .execute()
            )
        except Exception as exc:
            print(f"[rag] load imported final replies failed: {exc}")
            return []

        replies: list[str] = []
        for row in result.data or []:
            review = row.get("reviews") or {}
            if review.get("status") not in ("imported", "approved"):
                continue
            reply = (row.get("final_reply") or "").strip()
            if reply:
                replies.append(reply)
        return _dedupe(replies)

    # ------------------------------------------------------------------ learned replies

    async def _add_learned_reply(self, store_id: str, reply_text: str) -> None:
        """Prepend a real posted reply to brand_voice_config.learned_replies (capped at 20) and embed it."""
        bv = (
            self._db.table("brand_voice_config")
            .select("id, learned_replies")
            .eq("store_id", store_id)
            .maybe_single()
            .execute()
        ).data
        if not bv:
            return
        current = bv.get("learned_replies") or []
        deduped = [reply_text] + [r for r in current if r != reply_text]
        self._db.table("brand_voice_config").update(
            {"learned_replies": deduped[:20]}
        ).eq("id", bv["id"]).execute()

        emb = await self._embed_text(reply_text)
        if emb:
            self._store_embedding(store_id, reply_text, emb, "learned")

    def _set_status(self, review_id: str, status: str) -> None:
        self._db.table("reviews").update({"status": status, "updated_at": _now()}).eq("id", review_id).execute()

    def _write_decision(self, review_id: str, decision: str) -> None:
        self._db.table("review_actions").update({"decision": decision}).eq("review_id", review_id).execute()

    def _save_action(
        self,
        review_id: str,
        risk_score: int,
        sentiment_label: str,
        agent_reasoning: str,
        draft_reply: str | None,
        confidence: int,
        order_context: dict | None,
        risk_flags: list[str],
        agent_trace: dict,
    ) -> None:
        self._db.table("review_actions").upsert(
            {
                "review_id": review_id,
                "risk_score": risk_score,
                "sentiment_label": sentiment_label,
                "agent_reasoning": agent_reasoning,
                "draft_reply": draft_reply,
                "confidence": confidence,
                "order_context": order_context,
                "risk_flags": risk_flags,
                "agent_trace": agent_trace,
            },
            on_conflict="review_id",
        ).execute()
