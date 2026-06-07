import json
import uuid
from google.adk import Agent, Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types

INSTRUCTION = """You are a customer review classifier for an e-commerce brand response agent.

Analyze the review and output ONLY a valid JSON object — no markdown, no explanation, no code fences.

Output schema:
{
  "risk_score": <integer 0-10>,
  "sentiment_label": <"positive" | "neutral" | "negative">,
  "needs_order_context": <boolean, true if the review references a specific order, shipment, product defect, or missing item>,
  "agent_reasoning": <one paragraph explaining the classification>
}

Risk score guide:
0-3: Routine review, safe to auto-reply
4-6: Moderate concern (mild complaint, partial refund mention, ambiguous situation)
7-10: High risk (threats, legal language, severe product failure, public PR risk, explicit refund demand)

Be conservative: when in doubt, score higher."""


class ClassifierAgent:
    def __init__(self) -> None:
        self._agent = Agent(
            name="classifier",
            model="gemini-2.5-flash",
            instruction=INSTRUCTION,
            description="Classifies customer reviews for risk score and sentiment",
        )
        self._runner = Runner(
            app_name="heard_classifier",
            agent=self._agent,
            session_service=InMemorySessionService(),
        )

    async def classify(self, reviewer_name: str, rating: int, body: str, source: str) -> dict:
        prompt = f"Source: {source}\nReviewer: {reviewer_name}\nRating: {rating}/5\n\nReview:\n{body}"
        message = types.Content(role="user", parts=[types.Part(text=prompt)])
        session_id = f"classify_{uuid.uuid4().hex}"
        await self._runner.session_service.create_session(
            app_name="heard_classifier",
            user_id="orchestrator",
            session_id=session_id,
        )

        response_text = ""
        async for event in self._runner.run_async(
            user_id="orchestrator",
            session_id=session_id,
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
