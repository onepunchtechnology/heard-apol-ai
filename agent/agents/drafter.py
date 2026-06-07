import json
import os
import sys
import uuid

from google.adk import Agent, Runner
from google.adk.sessions import InMemorySessionService
from google.adk.tools.mcp_tool.mcp_toolset import McpToolset, StdioConnectionParams
from google.genai import types
from mcp import StdioServerParameters

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
  "confidence": <integer 0-100, your confidence this reply is appropriate and on-brand>
}

Rules:
- Match the tone and style described in the brand voice config
- Address the review content directly and specifically
- Do NOT make promises, guarantees, or refund offers
- Do NOT mention competitors
- Do NOT include personal contact info or discount codes
- Keep the reply between 50-300 words
- Be warm, genuine, and human — never corporate or robotic"""


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
- Rules: {json.dumps(brand_voice.get('rules', []))}
- Sample replies (brand voice grounding): {json.dumps(brand_voice.get('sample_replies', [])[:3])}
"""

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

If needs_order_context is true, call fetch_order_context before drafting. Then output the JSON reply."""

        message = types.Content(role="user", parts=[types.Part(text=prompt)])

        env = {
            **os.environ,
            "SHOPIFY_SHOP_DOMAIN": shop_domain or "",
            "SHOPIFY_ACCESS_TOKEN": access_token or "",
        }

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

        agent = Agent(
            name="drafter",
            model="gemini-2.5-flash",
            instruction=INSTRUCTION,
            description="Drafts on-brand replies to customer reviews; uses Shopify MCP for order context on complaints",
            tools=[toolset],
        )
        runner = Runner(
            app_name="heard_drafter",
            agent=agent,
            session_service=InMemorySessionService(),
        )

        response_text = ""
        try:
            async for event in runner.run_async(
                user_id="orchestrator",
                session_id=f"draft_{uuid.uuid4().hex}",
                new_message=message,
            ):
                if event.content and event.content.parts:
                    for part in event.content.parts:
                        if hasattr(part, "text") and part.text:
                            response_text += part.text
        finally:
            await toolset.close()

        cleaned = response_text.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("```")[1]
            if cleaned.startswith("json"):
                cleaned = cleaned[4:]
        return json.loads(cleaned.strip())
