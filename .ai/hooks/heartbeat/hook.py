#!/usr/bin/env python3
"""PostToolUse hook: append one heartbeat line per tool call made by a dcl-* agent
(time, agent type, session id, tool, cwd) to ~/.claude/heartbeats/creator-hub.log,
so the orchestrator can check a teammate's liveness without messaging it. Reads the
hook payload as JSON on stdin; writes nothing for other sessions; always exits 0.
"""
import datetime
import json
import pathlib
import sys

LOG = pathlib.Path.home() / ".claude" / "heartbeats" / "creator-hub.log"


def main() -> int:
    try:
        data = json.load(sys.stdin)
    except Exception:
        return 0
    agent = str(data.get("agent_type") or "")
    if not agent.startswith("dcl-"):
        return 0
    now = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    fields = (now, agent, data.get("session_id", ""), data.get("tool_name", ""), data.get("cwd", ""))
    LOG.parent.mkdir(parents=True, exist_ok=True)
    with LOG.open("a") as log:
        log.write("\t".join(str(f) for f in fields) + "\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
