"""Tests for the heartbeat hook. Run: python3 -m unittest discover -s .ai/hooks/heartbeat"""
import importlib.util
import io
import json
import pathlib
import tempfile
import unittest
from unittest import mock

spec = importlib.util.spec_from_file_location("hook", pathlib.Path(__file__).with_name("hook.py"))
hook = importlib.util.module_from_spec(spec)
spec.loader.exec_module(hook)

PAYLOAD = {
    "agent_type": "dcl-inspector-specialist",
    "agent_id": "agent-42",
    "session_id": "session-1",
    "tool_name": "Bash",
    "cwd": "/repo",
}


def run(log, payload=PAYLOAD):
    with mock.patch.object(hook, "LOG", log), mock.patch("sys.stdin", io.StringIO(json.dumps(payload))):
        return hook.main()


class HeartbeatHookTest(unittest.TestCase):
    def setUp(self):
        self.tmp = pathlib.Path(tempfile.mkdtemp())
        self.log = self.tmp / "heartbeats" / "creator-hub.log"

    def test_logs_the_agent_id_after_the_agent_type(self):
        self.assertEqual(run(self.log), 0)
        fields = self.log.read_text(encoding="utf-8").rstrip("\n").split("\t")
        self.assertEqual(fields[1:], ["dcl-inspector-specialist", "agent-42", "session-1", "Bash", "/repo"])

    def test_exits_zero_when_the_log_directory_cannot_be_created(self):
        blocker = self.tmp / "blocker"
        blocker.write_text("", encoding="utf-8")
        self.assertEqual(run(blocker / "heartbeats" / "creator-hub.log"), 0)

    def test_exits_zero_when_the_log_cannot_be_opened(self):
        self.log.mkdir(parents=True)
        self.assertEqual(run(self.log), 0)

    def test_rotates_the_log_once_it_exceeds_the_cap(self):
        self.log.parent.mkdir(parents=True)
        self.log.write_text("x" * 20, encoding="utf-8")
        with mock.patch.object(hook, "MAX_BYTES", 10):
            run(self.log)
        self.assertEqual(self.log.with_name("creator-hub.log.1").read_text(encoding="utf-8"), "x" * 20)
        self.assertEqual(len(self.log.read_text(encoding="utf-8").splitlines()), 1)

    def test_ignores_sessions_that_are_not_dcl_agents(self):
        self.assertEqual(run(self.log, {**PAYLOAD, "agent_type": "Explore"}), 0)
        self.assertFalse(self.log.exists())


if __name__ == "__main__":
    unittest.main()
