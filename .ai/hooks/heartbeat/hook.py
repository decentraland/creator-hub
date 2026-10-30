#!/usr/bin/env python3
"""PostToolUse hook: append one heartbeat line per tool call made by a dcl-* agent
(time, agent type, agent id, session id, tool, cwd) to ~/.claude/heartbeats/creator-hub.log,
so the orchestrator can check a teammate's liveness without messaging it. Rotates the log
to creator-hub.log.1 past MAX_BYTES. Reads the hook payload as JSON on stdin; writes
nothing for other sessions; always exits 0.
"""
import datetime
import json
import pathlib
import sys

LOG = pathlib.Path.home() / ".claude" / "heartbeats" / "creator-hub.log"
MAX_BYTES = 5 * 1024 * 1024


def main() -> int:
    try:
        data = json.load(sys.stdin)
        agent = str(data.get("agent_type") or "")
        if not agent.startswith("dcl-"):
            return 0
        now = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        fields = (
            now,
            agent,
            data.get("agent_id", ""),
            data.get("session_id", ""),
            data.get("tool_name", ""),
            data.get("cwd", ""),
        )
        LOG.parent.mkdir(parents=True, exist_ok=True)
        if LOG.exists() and LOG.stat().st_size > MAX_BYTES:
            LOG.replace(LOG.with_name(LOG.name + ".1"))
        with LOG.open("a", encoding="utf-8") as log:
            log.write("\t".join(str(f) for f in fields) + "\n")
    except Exception:
        pass
    return 0


if __name__ == "__main__":
    sys.exit(main())
