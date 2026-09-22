#!/usr/bin/env python3
"""UserPromptSubmit hook: when a prompt references Figma, inject a reminder to
load the project's figma skill first. Reads the hook payload as JSON on stdin;
prints reminder text (added to the turn's context) only on a match; always
exits 0 so it never blocks a prompt.
"""
import json
import re
import sys

TRIGGER = re.compile(r"figma\.com|\bfigma\b", re.IGNORECASE)

REMINDER = (
    "This message references Figma. Before any design/visual work, read "
    ".ai/skills/figma/SKILL.md first — it is this repo's Figma→code workflow: "
    "pull the design via the figma-implement-design skill or the Claude-in-Chrome "
    "browser fallback (when the Figma MCP is capped), verify against the running "
    "Creator Hub / inspector, and follow the palette-sync and SVG/CSS rules."
)


def main() -> int:
    try:
        data = json.load(sys.stdin)
    except Exception:
        return 0
    if TRIGGER.search(str(data.get("prompt", ""))):
        print(REMINDER)
    return 0


if __name__ == "__main__":
    sys.exit(main())
