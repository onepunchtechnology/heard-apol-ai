import json
import os
import sys
import uuid

from google.adk import Agent, Runner
from google.adk.sessions import InMemorySessionService, VertexAiSessionService
from google.adk.tools.mcp_tool.mcp_toolset import McpToolset, StdioConnectionParams
from google.genai import types
from mcp import StdioServerParameters


def _make_session_service():
    agent_engine_id = os.environ.get("GOOGLE_CLOUD_AGENT_ENGINE_ID")
    if agent_engine_id:
        return VertexAiSessionService(
            project=os.environ.get("GOOGLE_CLOUD_PROJECT"),
            location=os.environ.get("GOOGLE_CLOUD_LOCATION", "us-central1"),
            agent_engine_id=agent_engine_id,
        )
    return InMemorySessionService()

_MCP_SERVER = os.path.join(os.path.dirname(__file__), "..", "tools", "shopify_mcp_server.py")

INSTRUCTION = """You are a brand reply drafter for an e-commerce store's review response agent.

You have access to a `fetch_order_context` tool that looks up Shopify order details by reviewer name.

Steps:
1. If classification shows `needs_order_context: true`, call `fetch_order_context` with the reviewer's name BEFORE drafting.
2. Draft a reply using the brand voice config, review content, classification, and any order context retrieved.

Output ONLY a valid JSON object — no markdown, no explanation, no code fences.

Output schema:
{
  "draft_reply": <the reply text, plain text, no markdown>,
  "confidence": <integer 0-100, your confidence this reply is appropriate and on-brand>,
  "order_context": <if you called fetch_order_context, include the raw order JSON object here; otherwise null>
}

Rules:
- Match the tone and style described in the brand voice config
- Address the review content directly and specifically
- Do NOT make promises, guarantees, or refund offers
- Do NOT mention competitors
- Do NOT include personal contact info or discount codes
- Keep the reply between 50-300 words
- Be warm, genuine, and human — never corporate or robotic"""


def _fallback_reply(review: dict, classification: dict) -> str:
    name = review.get("reviewer_name") or "there"
    product = review.get("product_title") or "your order"
    sentiment = classification.get("sentiment_label")
    if sentiment == "positive":
        return (
            f"Thank you so much, {name}! We are so happy to hear you loved {product}. "
            "We put a lot of care into every order, and it means a lot to know it arrived well."
        )
    return (
        f"Hi {name}, thank you for letting us know about {product}. "
        "We are sorry this was not the experience you expected. We are holding this for our team "
        "to review carefully so we can respond with the right next step."
    )


class DrafterAgent:
    async def draft(
        self,
        review: dict,
        classification: dict,
        brand_voice: dict | None,
        shop_domain: str | None = None,
        access_token: str | None = None,
    ) -> dict:
        brand_config = ""
        if brand_voice:
            is_negative = classification.get("sentiment_label") == "negative"
            tone = brand_voice.get(
                "tone_negative" if is_negative else "tone_positive"
            ) or brand_voice.get("tone_description") or "warm"
            brand_config = f"""
Brand Voice Config:
- Tone: {tone} ({"complaints and negative reviews" if is_negative else "positive and neutral reviews"})
- Description: {brand_voice.get('tone_description', '')}
- Prohibited phrases (NEVER use): {json.dumps(brand_voice.get('rules', []))}
- Voice examples — real merchant replies when available, AI-generated otherwise (match this style closely): {json.dumps(brand_voice.get('sample_replies', [])[:3])}
"""

        needs_context = classification.get("needs_order_context", False)
        has_order_tool = bool(needs_context and shop_domain and access_token)
        if needs_context and not has_order_tool:
            context_instruction = (
                "This review would normally need order context, but no order lookup tool is available "
                "for this store yet. Do not call fetch_order_context. Draft a careful public reply "
                "that acknowledges the issue, avoids promises or refunds, and routes the review for human follow-up."
            )
        elif has_order_tool:
            context_instruction = (
                "Needs order context is true. Call fetch_order_context before drafting, then output the JSON reply."
            )
        else:
            context_instruction = "Order context is not needed. Output the JSON reply."

        prompt = f"""{brand_config}
Review to reply to:
- Source: {review.get('source')}
- Reviewer: {review.get('reviewer_name')}
- Rating: {review.get('rating')}/5
- Review: {review.get('body')}

Classification:
- Sentiment: {classification.get('sentiment_label')}
- Risk Score: {classification.get('risk_score')}
- Needs order context: {classification.get('needs_order_context', False)}
- Reasoning: {classification.get('agent_reasoning')}

{context_instruction}"""

        message = types.Content(role="user", parts=[types.Part(text=prompt)])

        env = {
            **os.environ,
            "SHOPIFY_SHOP_DOMAIN": shop_domain or "",
            "SHOPIFY_ACCESS_TOKEN": access_token or "",
        }

        # Only launch the MCP subprocess when order context is actually needed.
        # Launching unconditionally would make a subprocess crash kill all drafts,
        # not just the complaint path.
        toolset = None
        tools: list = []
        if has_order_tool:
            toolset = McpToolset(
                connection_params=StdioConnectionParams(
                    server_params=StdioServerParameters(
                        command=sys.executable,
                        args=[_MCP_SERVER],
                        env=env,
                    ),
                    timeout=10.0,
                )
            )
            tools = [toolset]

        agent = Agent(
            name="drafter",
            model="gemini-2.5-flash",
            instruction=INSTRUCTION,
            description="Drafts on-brand replies to customer reviews; uses Shopify MCP for order context on complaints",
            tools=tools,
        )
        runner = Runner(
            app_name="heard_drafter",
            agent=agent,
            session_service=_make_session_service(),
        )
        session_id = f"draft_{uuid.uuid4().hex}"
        await runner.session_service.create_session(
            app_name="heard_drafter",
            user_id="orchestrator",
            session_id=session_id,
        )

        response_text = ""
        try:
            async for event in runner.run_async(
                user_id="orchestrator",
                session_id=session_id,
                new_message=message,
            ):
                if event.content and event.content.parts:
                    for part in event.content.parts:
                        if hasattr(part, "text") and part.text:
                            response_text += part.text
        finally:
            if toolset is not None:
                await toolset.close()

        cleaned = response_text.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("```")[1]
            if cleaned.startswith("json"):
                cleaned = cleaned[4:]
        cleaned = cleaned.strip()
        # When MCP tool calls precede the final output, preamble text is
        # concatenated with the JSON. Find the start of the JSON object.
        if cleaned and not cleaned.startswith("{"):
            start = cleaned.find("{")
            if start != -1:
                cleaned = cleaned[start:]
        result = json.loads(cleaned.strip())
        draft_reply = str(result.get("draft_reply") or "")
        if not draft_reply.strip():
            result["draft_reply"] = _fallback_reply(review, classification)
            result["confidence"] = result.get("confidence") or 50
            result["order_context"] = result.get("order_context") or None
        return result
