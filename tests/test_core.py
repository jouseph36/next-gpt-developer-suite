import json
import tempfile
import unittest
from pathlib import Path

from nextgpt.agents import AgentSpec
from nextgpt.evaluation import run_cases
from nextgpt.factory import scaffold
from nextgpt.memory import ProjectMemory
from nextgpt.security import find_possible_secrets, safe_name

class CoreTests(unittest.TestCase):
    def test_agent_valid(self):
        AgentSpec("test-agent", "Assist developers").validate()

    def test_agent_requires_purpose(self):
        with self.assertRaises(ValueError):
            AgentSpec("test-agent", "").validate()

    def test_agent_requires_approval(self):
        with self.assertRaises(ValueError):
            AgentSpec("test-agent", "Test", requires_approval_for_writes=False).validate()

    def test_reject_bad_name(self):
        with self.assertRaises(ValueError):
            safe_name("../bad")

    def test_scaffold(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder = scaffold("demo-agent", tmp)
            self.assertTrue((folder / "agent.json").exists())
            with self.assertRaises(FileExistsError):
                scaffold("demo-agent", tmp)

    def test_evaluation(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "cases.json"
            path.write_text(json.dumps([{"id": "ok", "actual": 2, "expected": 2}, {"id": "bad", "actual": 1, "expected": 2}]))
            result = run_cases(str(path))
            self.assertEqual(result["passed"], 1)

    def test_memory(self):
        with tempfile.TemporaryDirectory() as tmp:
            memory = ProjectMemory(str(Path(tmp) / "memory.json"))
            memory.set("goal", "safe agents")
            self.assertEqual(memory.read()["goal"], "safe agents")

    def test_secret_detection(self):
        self.assertIn("private_key", find_possible_secrets("-----BEGIN PRIVATE KEY-----"))
