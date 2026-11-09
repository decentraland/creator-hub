---
name: figma
description: Project umbrella for Figma→code work in the inspector / Creator Hub. Read this FIRST whenever a task involves Figma — a figma.com URL, the word "figma", "design from figma", "match the design", or restyling/building UI to a spec. It sets the design loop (Match → user answers → Spec → test-first implementation → Validate against the live Figma frame → user sign-off → decisions in docs/DESIGN.md), the MCP budget (structure from the MCP, values from the browser), and links the references for browser extraction, screenshots, the multi-page sync, change detection and SVG/CSS gotchas.
---

# Figma → code (project workflow)

## When to use

Any visual/design task tied to Figma: a figma.com URL, "figma", "design from figma", "match the design", or restyling a panel / building icons / tuning colours-sizes-spacing to a spec. NOT for logic changes or refactors.

Visual pixel-match is a render→adjust loop. Run it against **Figma** and the **real render** (the running app) — never guess-and-check through the user. If you have neither, you become the spec sheet and the screen. Figma wins where it draws: where Figma draws a value or a control, the code follows it.

`dcl-designer-specialist` (`.claude/agents/`) is the agent that owns this loop end to end: it turns a frame into a spec for the inspector and Creator Hub specialists, syncs Figma into `docs/DESIGN.md` and the token files, and validates the implemented render. This skill is the how-to it follows; each step below links the reference that holds its full procedure.

## The loop

Work in **units, small to big**: one Figma component set per unit (primitives, then the composites built from them), then one **assembly unit** per surface, validated against the board that draws every variant of it. Each unit gets its own Match, spec, Validate, sign-off and spoke PR. Full rules: [`references/design-loop.md`](references/design-loop.md).

1. **Match.** Read the unit's set and its board fresh, state the frame ↔ screen mapping, and compare them with the running code in a short match / mismatch table. Where Figma draws a value or a control, a mismatch is a fix, never a question. List every question about what Figma doesn't draw (focus, drop, keyboard, user-facing names, behaviour, which board governs), each with a recommended default. Change detection tells you what moved since the last read: [`references/change-detection.md`](references/change-detection.md). Mapping and reuse rules: [`references/mapping-and-reuse.md`](references/mapping-and-reuse.md). When the work starts from Figma comments, harvest every matching thread, replies included, into a ledger first: [`references/comments.md`](references/comments.md).
2. **User answers.** The lead asks the questions interactively in one sitting (AskUserQuestion, up to four per call, recommended option first). No spec or code starts until the answers are in, and each is written into `docs/DESIGN.md` as the current rule before the spec.
3. **Spec.** From the board, not from its parts: list every board variant with its node id, re-confirm each standing decision against it, and write the spec in the fixed format of [`references/spec-template.md`](references/spec-template.md), at `docs/specs/<unit>/spec.md` (excluded locally, never committed). Grep `vars.css` / `theme.css` for every literal first, and check `components/ui/` for a control that already exists. Compute every contrast on the real surface with [`scripts/wcag.mjs`](scripts/wcag.mjs) (`node .ai/skills/figma/scripts/wcag.mjs <fg> <bg> [alpha]`).
4. **Implement test-first.** The inspector or Creator Hub specialist writes the failing test, then the code, from the spec. Code ships in a **spoke** PR; docs, skills and agents ship in the **hub**. The hub writes the `docs/DESIGN.md` row (marked `ships in #<spoke>`); the spoke changes the value and touches none of `docs .ai .claude .github skills-lock.json CLAUDE.md '**/*.md'` (`git diff --name-only <base>...HEAD -- docs .ai .claude .github skills-lock.json CLAUDE.md '*.md'` prints nothing).
5. **Validate, at most three rounds.** Re-read the set and the board, then judge the running render against the Figma frame itself, never the spec alone. Shoot every state on the standalone inspector and the key surfaces inside Creator Hub ([`references/screenshots.md`](references/screenshots.md)), check the accessibility tree, and class each mismatch: code drift → the implementer, doc drift → the designer, Figma silent or defective → the user. An accepted ✱ deviation, or a row in `docs/DESIGN.md` → Open items, is not drift. Report each round in [`references/validate-report.md`](references/validate-report.md). After three rounds without a pass, stop and ask the user.
6. **User sign-off.** Show the user one Before | After | Figma grid per component, a row per state, and ask whether it is what they meant, before the PR is opened or marked done.
7. **Decisions in `docs/DESIGN.md`.** Every answer from the match pass, the rounds and the sign-off becomes the current rule: in the value row it governs, or a `| Topic | Rule |` row in the component's **Decisions** table, marked ✱ where it departs from Figma and "user decision" where it was the user's call. No dates, question numbers or earlier answers. The next unit and the next session grep `docs/DESIGN.md` before asking again.

Figma moves while you work: re-read the set and its board at the start of Spec, right before handing to the implementer, and at the start of every Validate round, and record the read time and the diff in the spec's §0.

## MCP for structure, browser for values

- **The budget.** The Figma MCP allows **20 read calls a month** on this account's seats, and every read tool counts, `get_metadata` included. `whoami` is free and lists the seats; nothing reports the remaining count. Never spend a call to probe the budget, pace calls ≥ 10 s apart, and on `reached the Figma MCP tool call limit` put the error text in the handoff and finish in the browser.
- **Spend calls on structure.** `get_metadata` for a page's sets, variants and node ids, and `get_design_context` / `get_variable_defs` on a dense, new or ambiguous set. Node-addressed calls serve any page; only the no-`nodeId` page listing is pinned to COVER. Pass a frame or set id, never a page id, to `get_variable_defs`. Page ids are in `docs/DESIGN.md` → "Pages inventory".
- **Read values in the browser.** Claude-in-Chrome on the `?node-id=` URL, with the Properties panel as the value source, Figma's client store for the page list, and canvas zooms labelled "canvas measurement (±2px)": [`references/browser-extraction.md`](references/browser-extraction.md).
- **Leaf skills are checklists only.** The installed `figma-implement-design` skill and the MCP server's `/figma-design-to-code` describe what a design-to-code pass covers; their fetch order ("Always fetch `get_design_context` and `get_screenshot` first") does not apply here, because the budget above overrides it. This skill wins wherever they differ. The downloaded skills are pinned in `skills-lock.json`; `web-design-guidelines` is vendored in `.ai/skills/` at a fixed commit. If missing, run `make install-skills`, then `/reload-skills`.
- **A multi-page sync** (the Design System → `docs/DESIGN.md`) follows [`references/extraction-runbook.md`](references/extraction-runbook.md).

## References

| File | Holds |
| --- | --- |
| [`references/design-loop.md`](references/design-loop.md) | Units, the star PR layout, the match pass, decisions, board reads, mismatch classes, the stop condition |
| [`references/mapping-and-reuse.md`](references/mapping-and-reuse.md) | Frame ↔ screen mapping, the reuse audit, palette sync, verifying against the real render |
| [`references/browser-extraction.md`](references/browser-extraction.md) | The MCP budget in full and the Claude-in-Chrome Properties-panel procedure |
| [`references/comments.md`](references/comments.md) | Harvesting a designer's comment threads, the ledger, mapping a comment to a node and property |
| [`references/change-detection.md`](references/change-detection.md) | The page, set and value diffs that decide what to re-read |
| [`references/extraction-runbook.md`](references/extraction-runbook.md) | Running a multi-page sync into `docs/DESIGN.md` |
| [`references/screenshots.md`](references/screenshots.md) | Capture, grids, Creator Hub shots, the fully-visible guard, uploading to the PR body |
| [`references/svg-css-gotchas.md`](references/svg-css-gotchas.md) | Glyph export, viewBox, `currentColor`, selector specificity, accessible names, the gates CSS slips past |
| [`references/spec-template.md`](references/spec-template.md) | The spec's fixed sections |
| [`references/validate-report.md`](references/validate-report.md) | The Validate round's table and verdict |
| [`scripts/wcag.mjs`](scripts/wcag.mjs) | `node wcag.mjs <fg> <bg> [alpha]`, and `--self-test` |

## After the change, verify these are still TRUE

A Figma→code task fails quietly, not loudly. Confirm:

- no CSS was added for a value that's already a token or a shipped default;
- an existing component (with its validation) was reused, not re-implemented;
- every control still has an accessible name — not just that the old label is gone;
- nothing the code renders is missing from Figma without the user's answer: every option, list entry, state and string is drawn (a node id) or was asked about;
- every data state the spec lists (first load, back to the tab, empty, error, partial) renders as specced, including coming back to a tab that already loaded;
- the `.tsx` eslint baseline didn't grow.
