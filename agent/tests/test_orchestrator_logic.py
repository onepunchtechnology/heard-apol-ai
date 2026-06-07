import sys
import os
import re
import unittest
from pathlib import Path

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

AGENT_DIR = Path(__file__).resolve().parents[1]
ORCHESTRATOR = (AGENT_DIR / 'orchestrator.py').read_text()


class TestAutoPostThreshold(unittest.TestCase):
    """AUTO_POST_MAX_RISK must stay 3 per CLAUDE.md spec:
    'risk_score 0–3 AND guardrails pass → auto_post'"""

    def test_auto_post_max_risk_is_3(self):
        match = re.search(r'AUTO_POST_MAX_RISK\s*=\s*(\d+)', ORCHESTRATOR)
        self.assertIsNotNone(match, 'AUTO_POST_MAX_RISK constant must exist in orchestrator.py')
        self.assertEqual('3', match.group(1), 'AUTO_POST_MAX_RISK must be 3 per spec')

    def test_auto_post_uses_constant_not_literal(self):
        # Guard against someone inlining the threshold and forgetting the constant
        self.assertIn('AUTO_POST_MAX_RISK', ORCHESTRATOR)
        self.assertIn('risk_score <= AUTO_POST_MAX_RISK', ORCHESTRATOR)


class TestAtomicClaim(unittest.TestCase):
    """Orchestrator must use atomic claim RPC to prevent double-processing."""

    def test_uses_claim_rpc(self):
        self.assertIn('claim_review', ORCHESTRATOR,
                      'Orchestrator must call claim_review RPC for atomic status claim')

    def test_exits_when_claim_returns_empty(self):
        # After claim, there must be a guard that exits if no row returned
        claim_idx = ORCHESTRATOR.index('claim_review')
        after_claim = ORCHESTRATOR[claim_idx:claim_idx + 300]
        self.assertIn('return', after_claim,
                      'Orchestrator must return early when claim_review returns no data')

    def test_brand_voice_rag_step_logged(self):
        self.assertIn('brand_voice_rag', ORCHESTRATOR,
                      'brand_voice_rag step must be logged in agent_trace for Agents screen')


class TestShopifyApiVersion(unittest.TestCase):
    """Shopify API version must be 2026-01 everywhere — 2024-01 is wrong per CLAUDE.md."""

    def test_no_old_api_version_in_agent(self):
        offenders = []
        for path in AGENT_DIR.rglob('*.py'):
            if '.venv' in path.parts or 'tests' in path.parts:
                continue
            if '2024-01' in path.read_text():
                offenders.append(str(path.relative_to(AGENT_DIR)))
        self.assertEqual([], offenders,
                         f'These files use the wrong Shopify API version 2024-01: {offenders}')


class TestTwoToneBrandVoice(unittest.TestCase):
    """DrafterAgent must use tone_positive/tone_negative, never a single tone_description."""

    def test_drafter_reads_tone_positive(self):
        drafter = (AGENT_DIR / 'agents' / 'drafter.py').read_text()
        self.assertIn('tone_positive', drafter,
                      'DrafterAgent must read tone_positive from brand voice config')

    def test_drafter_reads_tone_negative(self):
        drafter = (AGENT_DIR / 'agents' / 'drafter.py').read_text()
        self.assertIn('tone_negative', drafter,
                      'DrafterAgent must read tone_negative from brand voice config')

    def test_orchestrator_passes_brand_voice_to_drafter(self):
        self.assertIn('brand_voice=bv', ORCHESTRATOR,
                      'Orchestrator must pass full brand_voice dict to drafter')


class TestStepHelper(unittest.TestCase):
    """_step() is used throughout the trace; verify its basic contract."""

    def setUp(self):
        # Import the _step function directly
        import importlib.util
        spec = importlib.util.spec_from_file_location(
            'orchestrator_mod',
            str(AGENT_DIR / 'orchestrator.py'),
        )

    def test_step_structure(self):
        # Parse _step signature from source to verify it produces the right keys
        # (can't import orchestrator.py directly — it reads env vars at module level)
        self.assertIn('def _step(name: str, status: str', ORCHESTRATOR)
        self.assertIn('"step": name', ORCHESTRATOR)
        self.assertIn('"status": status', ORCHESTRATOR)
        self.assertIn('"at": _now()', ORCHESTRATOR)


if __name__ == '__main__':
    unittest.main()
