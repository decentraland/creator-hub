---
name: web-design-guidelines
description: Review UI code against the Vercel Web Interface Guidelines, vendored in this folder at a fixed commit. Use when asked to review UI, check accessibility, audit a design, or review UX, and on every designer Validate pass over the implementer's changed files. Read-only: it reports findings and edits nothing.
argument-hint: <file-or-pattern>
---

# Web Interface Guidelines (vendored)

The rules live in `command.md`, next to this file. Read them from there. Never fetch the guidelines from the network: the copy here is the pinned version this repo reviews against.

## Source

| Field | Value |
| --- | --- |
| Upstream | `vercel-labs/web-interface-guidelines`, file `command.md` |
| Commit | `434b7f91364665f2f733b310ec54809bf8f37937` (2026-10-05, "Add desktop overscroll guideline") |
| License | MIT, © 2025 Vercel Labs; the full text is in `LICENSE`, next to this file |
| Copy | `command.md` and `LICENSE`, verbatim, unformatted |

To update, copy `command.md` and `LICENSE` from a newer upstream commit, byte for byte, and change the commit row above in the same change. Nothing installs or overwrites this folder: it is not in `skills-lock.json`, and `make install-skills` links it into `.claude/skills/` as it is. Claude Code loads skills only from `.claude/skills/` (gitignored), so a fresh clone runs `make install-skills` once before the skill can be invoked by name.

## How to run

1. Read `command.md` in full.
2. Read the files to review: the paths or pattern given, else the files the task changed. If neither is known, ask which files.
3. Check every file against every rule in `command.md`.
4. Report in `command.md`'s output format: findings grouped by file, each as `file:line` and a terse description, and a file with no findings marked as passing.

Edit nothing. Findings go back to whoever owns the code.
