import os
from datetime import datetime, timezone

import httpx
from supabase import create_client, Client

from agents.classifier import ClassifierAgent
from agents.drafter import DrafterAgent
from tools.shopify import fetch_order_context
from guardrails import check as guardrails_check

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

AUTO_POST_MAX_RISK = 3
JUDGEME_API_BASE = "https://judge.me/api/v1"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _step(name: str, status: str, **extra) -> dict:
    return {"step": name, "status": status, "at": _now(), **extra}


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
            .select("*, stores(shopify_domain, shopify_access_token, judgeme_api_token)")
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
            .maybeSingle()
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
            self._save_action(review_id, 9, "unknown", str(exc), None, 0, None, [], {"steps": trace})
            self._set_status(review_id, "needs_review")
            return

        risk_score: int = classification.get("risk_score", 5)
        sentiment: str = classification.get("sentiment_label", "neutral")
        needs_order_ctx: bool = classification.get("needs_order_context", False)
        reasoning: str = classification.get("agent_reasoning", "")

        # --- 5. Fetch order context if the classifier says it's needed ---
        order_context: dict | None = None
        if needs_order_ctx and store.get("shopify_domain") and store.get("shopify_access_token"):
            try:
                order_context = await fetch_order_context(
                    shop_domain=store["shopify_domain"],
                    access_token=store["shopify_access_token"],
                    reviewer_name=row.get("reviewer_name", ""),
                )
                trace.append(_step("fetch_order_context", "complete", found=order_context is not None))
            except Exception as exc:
                trace.append(_step("fetch_order_context", "warning", error=str(exc)))
        else:
            trace.append(_step("fetch_order_context", "skipped"))

        # --- 6. Draft ---
        try:
            draft_result = await self._drafter.draft(
                review=row,
                classification=classification,
                brand_voice=bv,
                order_context=order_context,
            )
            trace.append(_step("draft", "complete", confidence=draft_result.get("confidence")))
        except Exception as exc:
            trace.append(_step("draft", "failed", error=str(exc)))
            self._save_action(review_id, risk_score, sentiment, reasoning, None, 0, order_context, [], {"steps": trace})
            self._set_status(review_id, "needs_review")
            return

        draft_reply: str = draft_result.get("draft_reply", "")
        confidence: int = draft_result.get("confidence", 50)

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
        auto_post = risk_score <= AUTO_POST_MAX_RISK and gr.passed
        if auto_post:
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
                        f"{JUDGEME_API_BASE}/reviews/{row['external_id']}/reply",
                        json={
                            "api_token": store["judgeme_api_token"],
                            "shop_domain": store.get("shopify_domain", ""),
                            "body": draft_reply,
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
        else:
            self._set_status(review_id, "reply_pending_manual")
            trace.append(_step("post", "warning", reason="post_failed_or_unsupported_source"))
            print(f"[{review_id}] auto_post failed → reply_pending_manual")

    def _set_status(self, review_id: str, status: str) -> None:
        self._db.table("reviews").update({"status": status, "updated_at": _now()}).eq("id", review_id).execute()

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
