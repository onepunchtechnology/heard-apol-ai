import re
from dataclasses import dataclass, field

MAX_REPLY_CHARS = 1200
MIN_REPLY_CHARS = 20

_PROHIBITED_PATTERNS = [
    (r'\b(guarantee|guaranteed|100%|always|never fail)\b', 'unconditional_promise'),
    (r'\b(refund|money back|compensation|reimburs)\b', 'refund_offer'),
    (r'\b(competitor|better than|switch to|try [A-Z][a-z]+)\b', 'competitor_mention'),
    (r'\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b', 'phone_number_pii'),
    (r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b', 'email_pii'),
    (r'\b(free|freebie|discount code|promo code)\b', 'unsolicited_promo'),
    (r'(fuck|shit|ass|bitch|damn)\b', 'profanity'),
]

@dataclass
class GuardrailResult:
    passed: bool
    fired_flags: list[str] = field(default_factory=list)
    reason: str = ''


def check(draft: str) -> GuardrailResult:
    flags: list[str] = []

    if len(draft) > MAX_REPLY_CHARS:
        flags.append('reply_too_long')
    if len(draft.strip()) < MIN_REPLY_CHARS:
        flags.append('reply_too_short')

    for pattern, flag in _PROHIBITED_PATTERNS:
        if re.search(pattern, draft, re.IGNORECASE):
            flags.append(flag)

    if flags:
        return GuardrailResult(passed=False, fired_flags=flags, reason='; '.join(flags))
    return GuardrailResult(passed=True)
