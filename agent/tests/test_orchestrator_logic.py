import ast
import sys
import os
import re
import unittest
from pathlib import Path

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

AGENT_DIR = Path(__file__).resolve().parents[1]
ORCHESTRATOR = (AGENT_DIR / 'orchestrator.py').read_text()


def _load_should_auto_post():
    """Extract and exec only AUTO_POST_MAX_RISK + should_auto_post from source.

    orchestrator.py reads env vars at module level, preventing a plain import.
    AST extraction sidesteps all I/O and external imports.
    """
    tree = ast.parse(ORCHESTRATOR)
    selected = []
    for node in tree.body:
        if isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name) and target.id == 'AUTO_POST_MAX_RISK':
                    selected.append(node)
        elif isinstance(node, ast.FunctionDef) and node.name == 'should_auto_post':
            selected.append(node)
    mod = ast.Module(body=selected, type_ignores=[])
    ns: dict = {}
    exec(compile(mod, '<orchestrator-subset>', 'exec'), ns)  # noqa: S102
    return ns['should_auto_post']


_should_auto_post = _load_should_auto_post()


class TestAutoPostThreshold(unittest.TestCase):
    """AUTO_POST_MAX_RISK must stay 3 per CLAUDE.md spec:
    'risk_score 0–3 AND guardrails pass → auto_post'"""

    def test_auto_post_max_risk_is_3(self):
        match = re.search(r'AUTO_POST_MAX_RISK\s*=\s*(\d+)', ORCHESTRATOR)
        self.assertIsNotNone(match, 'AUTO_POST_MAX_RISK constant must exist in orchestrator.py')
        self.assertEqual('3', match.group(1), 'AUTO_POST_MAX_RISK must be 3 per spec')

    def test_auto_post_uses_should_auto_post(self):
        # Decision must go through should_auto_post(), not an inlined comparison
        self.assertIn('should_auto_post(risk_score', ORCHESTRATOR,
                      'process_review must delegate the auto-post decision to should_auto_post()')


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


class TestShouldAutoPost(unittest.TestCase):
    """Behavioral four-corner tests for the auto-post/escalate decision boundary.

    Spec (CLAUDE.md): risk_score 0–3 AND guardrails pass → auto_post
                      risk_score ≥ 4 OR any guardrail fired → escalate
    """

    def test_boundary_risk3_guardrails_pass(self):
        """risk=3 is the highest score that should auto-post."""
        self.assertTrue(_should_auto_post(3, True),
                        'risk_score=3 with guardrails passing must auto-post (boundary)')

    def test_boundary_risk4_guardrails_pass(self):
        """risk=4 must escalate even when guardrails are clean."""
        self.assertFalse(_should_auto_post(4, True),
                         'risk_score=4 with guardrails passing must escalate (boundary)')

    def test_guardrail_veto_low_risk(self):
        """A guardrail firing must escalate even when risk_score is 0."""
        self.assertFalse(_should_auto_post(0, False),
                         'risk_score=0 with a guardrail fired must escalate')

    def test_guardrail_veto_at_risk_boundary(self):
        """A guardrail firing must escalate even at the exact risk threshold."""
        self.assertFalse(_should_auto_post(3, False),
                         'risk_score=3 with a guardrail fired must still escalate')

    def test_mid_range_clean(self):
        """risk=2 with clean guardrails is safely within the auto-post zone."""
        self.assertTrue(_should_auto_post(2, True))

    def test_high_risk_guardrail_veto(self):
        """High risk + guardrail failure: double-escalation path must still be False."""
        self.assertFalse(_should_auto_post(9, False))


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
