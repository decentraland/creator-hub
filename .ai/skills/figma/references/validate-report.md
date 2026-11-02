# Validate report

One report per Validate round, saved as `docs/specs/<unit>/validate-round<N>.md` (excluded locally, never committed). Judge the running render against the Figma frame itself, not the spec alone ([`design-loop.md`](design-loop.md)), with one row per state on the spec's §8 screenshot checklist. Before classing a row, grep `docs/DESIGN.md`'s ✱ rows, its Open items and the spec's resolved decisions: an accepted deviation is ✱, not drift.

Classes and owners:

- **code**: `docs/DESIGN.md` is right and the render is wrong. Owner: the implementer.
- **doc**: `docs/DESIGN.md` or the spec differs from Figma. Owner: the designer, who fixes both before the implementer runs again.
- **figma**: Figma is silent or defective (no focus state drawn, a contrast miss). Owner: the user; an accepted answer becomes a ✱ row.
- **✱**: an accepted deviation; the row passes.

```markdown
# <Unit name> Validate

Round <N>/3 · Figma read <date and time> (diff against the spec's §0: <"unchanged" or the change>) · code at `<sha>`

| # | Component | State | Figma | Render | Class (code / doc / figma / ✱) | Owner | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | <component> | <state> | <drawn value, node id> | <rendered value> | <class, or "pass"> | <implementer / designer / user / —> | <After shot path, ariaSnapshot line, or grep> |

- Accessibility tree: <one line per touched control: name, role, state>.
- Guidelines: <`web-design-guidelines` findings on the changed files, or "none">.
- New literals: <hex or `rgba()` added in the touched files, or "none">.

Verdict: <pass | fail: N code, N doc, N figma>. <Next step: back to the implementer, the designer's doc fix, questions for the user, or, after round 3 without a pass, stop and ask the user.>
```
