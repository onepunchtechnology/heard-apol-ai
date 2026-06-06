import json
import uuid
from google.adk import Agent, Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types

INSTRUCTION = """You are a brand reply drafter for an e-commerce store's review response agent.

Draft a reply to the customer review. Follow the brand voice config exactly.

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
    def __init__(self) -> None:
        self._agent = Agent(
            name="drafter",
            model="gemini-2.5-flash",
            instruction=INSTRUCTION,
            description="Drafts on-brand replies to customer reviews",
        )
        self._runner = Runner(
            app_name="heard_drafter",
            agent=self._agent,
            session_service=InMemorySessionService(),
        )

    async def draft(
        self,
        review: dict,
        classification: dict,
        brand_voice: dict | None,
        order_context: dict | None,
    ) -> dict:
        brand_config = ""
        if brand_voice:
            brand_config = f"""
Brand Voice Config:
- Tone: {brand_voice.get('tone_description', 'friendly and professional')}
- Rules: {json.dumps(brand_voice.get('rules', []))}
- Sample replies: {json.dumps(brand_voice.get('sample_replies', [])[:2])}
"""

        order_section = ""
        if order_context:
            order_section = f"\nOrder Context:\n{json.dumps(order_context, indent=2)}\n"

        prompt = f"""{brand_config}
Review to reply to:
- Source: {review.get('source')}
- Reviewer: {review.get('reviewer_name')}
- Rating: {review.get('rating')}/5
- Review: {review.get('body')}

Classification:
- Sentiment: {classification.get('sentiment_label')}
- Risk Score: {classification.get('risk_score')}
- Reasoning: {classification.get('agent_reasoning')}
{order_section}
Draft a reply."""

        message = types.Content(role="user", parts=[types.Part(text=prompt)])

        response_text = ""
        async for event in self._runner.run_async(
            user_id="orchestrator",
            session_id=f"draft_{uuid.uuid4().hex}",
            new_message=message,
        ):
            if event.content and event.content.parts:
                for part in event.content.parts:
                    if part.text:
                        response_text += part.text

        cleaned = response_text.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("```")[1]
            if cleaned.startswith("json"):
                cleaned = cleaned[4:]
        return json.loads(cleaned.strip())
