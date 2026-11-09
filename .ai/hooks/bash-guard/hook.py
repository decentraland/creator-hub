#!/usr/bin/env python3
"""PreToolUse hook for Bash: refuse a unit-test run that has no thread cap or that would start
while another vitest is already running, and refuse an unsigned commit. Reads the hook payload
as JSON on stdin; exit 2 blocks the call and sends stderr back to the agent; any other outcome
exits 0. Commands that name another repo's checkout (js-sdk-toolchain, creators-data) are
left alone: those run their own test runners.
"""
import json
import re
import subprocess
import sys

OTHER_REPOS = ("js-sdk-toolchain", "creators-data")
CAP = "VITEST_MAX_THREADS=2 VITEST_MIN_THREADS=1"
TEST_RUN = re.compile(
    r"(?:^|[;&|(]\s*|\bnpx\s+|\bexec\s+)vitest\b"
    r"|\bvitest\s+run\b"
    r"|\bnpm\s+(?:run\s+)?test(?::[\w-]+)?\b"
    r"|\bmake\s+(?:[\w-]+\s+)*test\b"
)
CAPPED = re.compile(r"VITEST_MAX_(?:THREADS|FORKS)=|maxThreads=|maxForks=")
COMMIT = re.compile(r"\bgit\s+(?:-C\s+\S+\s+)?(?:commit|commit-tree)\b")
SIGNED = re.compile(r"(?:^|\s)(?:-S\S*|--gpg-sign\S*)(?=\s|$)")


def running_vitest() -> list[str]:
    try:
        out = subprocess.run(["pgrep", "-f", "node.*vitest"], capture_output=True, text=True, timeout=5)
    except Exception:
        return []
    return out.stdout.split()


def signing_on() -> bool:
    try:
        out = subprocess.run(["git", "config", "--get", "commit.gpgsign"], capture_output=True, text=True, timeout=5)
    except Exception:
        return True
    return out.stdout.strip().lower() == "true"


def problem(command: str) -> str:
    if not any(repo in command for repo in OTHER_REPOS) and TEST_RUN.search(command):
        if not CAPPED.search(command):
            return (
                "Blocked: an uncapped test run froze this machine. Prefix it with the thread cap, "
                f"e.g. `{CAP} make test`, or for one spec `npx vitest run -r renderer <path> "
                "--pool=threads --poolOptions.threads.maxThreads=2 --poolOptions.threads.minThreads=1`."
            )
        pids = running_vitest()
        if pids:
            return (
                f"Blocked: vitest is already running (pid {', '.join(pids)}). Run one test process at a "
                "time: wait for it to finish, or stop it if it is yours, then retry."
            )
    if COMMIT.search(command) and not SIGNED.search(command) and not signing_on():
        return "Blocked: commits on this repo must be signed. Add -S (or set commit.gpgsign=true)."
    return ""


def main() -> int:
    try:
        data = json.load(sys.stdin)
        if data.get("tool_name") != "Bash":
            return 0
        reason = problem(str((data.get("tool_input") or {}).get("command") or ""))
    except Exception:
        return 0
    if reason:
        print(reason, file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
