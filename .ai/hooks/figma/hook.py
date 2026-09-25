#!/usr/bin/env python3
"""UserPromptSubmit hook: when a prompt references Figma, inject a reminder to
load the project's figma skill first — and, if the leaf skills it delegates to
are not installed, the command to install them. Reads the hook payload as JSON on
stdin; prints only on a Figma match; always exits 0 so it never blocks a prompt.
"""
import json
import os
import re
import sys

TRIGGER = re.compile(r"\bfigma\b", re.IGNORECASE)

LEAVES = ("figma-implement-design", "figma-create-design-system-rules")
INSTALL = (
    "npx skills add openai/skills --skill "
    "figma-implement-design figma-create-design-system-rules "
    "--full-depth --copy --yes -a claude-code"
)

REMINDER = (
    "This message references Figma. Before any design/visual work, read "
    ".ai/skills/figma/SKILL.md first — it is this repo's Figma→code workflow: "
    "pull the design via the figma-implement-design skill or the Claude-in-Chrome "
    "browser fallback (when the Figma MCP is capped), verify against the running "
    "Creator Hub / inspector, and follow the palette-sync and SVG/CSS rules."
)


def missing_leaves(project_dir):
    """Leaf skills not found in the project or the user's global skills dir."""
    roots = [
        os.path.join(project_dir, ".claude", "skills"),
        os.path.join(os.path.expanduser("~"), ".claude", "skills"),
    ]
    return [s for s in LEAVES if not any(os.path.exists(os.path.join(r, s)) for r in roots)]


def main() -> int:
    try:
        data = json.load(sys.stdin)
    except Exception:
        return 0
    if not isinstance(data, dict) or not TRIGGER.search(str(data.get("prompt", ""))):
        return 0
    print(REMINDER)

    missing = missing_leaves(os.environ.get("CLAUDE_PROJECT_DIR", ""))
    if missing:
        print(
            f"\nYou don't have the {', '.join(missing)} skill(s) installed. Run:\n"
            f"  {INSTALL}\n"
            "to install them, then `/reload-skills` to properly use this figma skill."
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
