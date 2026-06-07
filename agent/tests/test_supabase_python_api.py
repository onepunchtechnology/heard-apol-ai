from pathlib import Path
import unittest


class SupabasePythonApiTest(unittest.TestCase):
    def test_agent_uses_python_supabase_method_names(self) -> None:
        agent_dir = Path(__file__).resolve().parents[1]
        offenders: list[str] = []

        for path in agent_dir.rglob("*.py"):
            if ".venv" in path.parts or "tests" in path.parts:
                continue

            text = path.read_text()
            if ".maybe" + "Single(" in text:
                offenders.append(str(path.relative_to(agent_dir)))

        self.assertEqual([], offenders)

    def test_adk_sessions_are_created_before_run_async(self) -> None:
        agent_dir = Path(__file__).resolve().parents[1]

        for path in [
            agent_dir / "agents" / "classifier.py",
            agent_dir / "agents" / "drafter.py",
        ]:
            text = path.read_text()
            self.assertIn(".create_session(", text, str(path.relative_to(agent_dir)))
            self.assertLess(
                text.index(".create_session("),
                text.index(".run_async("),
                str(path.relative_to(agent_dir)),
            )

    def test_classifier_failure_uses_db_valid_sentiment(self) -> None:
        orchestrator = (Path(__file__).resolve().parents[1] / "orchestrator.py").read_text()

        self.assertNotIn('_save_action(review_id, 9, "unknown"', orchestrator)
        self.assertIn('_save_action(review_id, 9, "neutral"', orchestrator)
