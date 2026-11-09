"""Tests for the Bash guard hook. Run: python3 -m unittest discover -s .ai/hooks/bash-guard"""
import importlib.util
import io
import json
import pathlib
import unittest
from unittest import mock

spec = importlib.util.spec_from_file_location("hook", pathlib.Path(__file__).with_name("hook.py"))
hook = importlib.util.module_from_spec(spec)
spec.loader.exec_module(hook)


def run(command, running=(), signing=False, tool="Bash"):
    payload = {"tool_name": tool, "tool_input": {"command": command}}
    with mock.patch.object(hook, "running_vitest", return_value=list(running)), mock.patch.object(
        hook, "signing_on", return_value=signing
    ), mock.patch("sys.stdin", io.StringIO(json.dumps(payload))), mock.patch("sys.stderr", io.StringIO()):
        return hook.main()


class BashGuardTest(unittest.TestCase):
    def test_blocks_uncapped_test_runs(self):
        for command in (
            "make test",
            "make init && make test",
            "cd packages/creator-hub && npm run test:unit",
            "npm test",
            "npx vitest run -r renderer src/a.spec.tsx",
            "(cd packages/inspector && vitest run)",
        ):
            with self.subTest(command=command):
                self.assertEqual(run(command), 2)

    def test_allows_capped_test_runs(self):
        for command in (
            "VITEST_MAX_THREADS=2 VITEST_MIN_THREADS=1 make test",
            "npx vitest run -r renderer a.spec.tsx --pool=threads --poolOptions.threads.maxThreads=2",
        ):
            with self.subTest(command=command):
                self.assertEqual(run(command), 0)

    def test_blocks_a_second_test_process(self):
        self.assertEqual(run("VITEST_MAX_THREADS=2 make test", running=["4242"]), 2)

    def test_ignores_commands_that_only_mention_vitest(self):
        for command in ("rg -n vitest package.json", "cat vitest.config.ts", "git log --oneline -3"):
            with self.subTest(command=command):
                self.assertEqual(run(command), 0)

    def test_leaves_other_repos_alone(self):
        self.assertEqual(run("cd ~/orca/workspaces/js-sdk-toolchain/main && make test"), 0)
        self.assertEqual(run("cd ~/Projects/creators-data && npm test"), 0)

    def test_blocks_unsigned_commits_when_signing_is_off(self):
        self.assertEqual(run("git commit -m 'fix: x'"), 2)
        self.assertEqual(run("git -C /repo commit-tree abc -p def -m x"), 2)

    def test_allows_signed_commits(self):
        self.assertEqual(run("git commit -S -m 'fix: x'"), 0)
        self.assertEqual(run("git commit -m 'fix: x'", signing=True), 0)

    def test_ignores_other_tools_and_bad_payloads(self):
        self.assertEqual(run("make test", tool="Read"), 0)
        with mock.patch("sys.stdin", io.StringIO("not json")):
            self.assertEqual(hook.main(), 0)


if __name__ == "__main__":
    unittest.main()
