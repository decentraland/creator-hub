# Why does typing in the hierarchy tree cost 280ms per keystroke?

This is a research handoff, not a solution. It records a measured performance
finding in the Inspector and the evidence behind it, so the next person starts
from data instead of re-deriving it.

**The question to answer:** why does a single character typed into the
hierarchy tree's entity-name input cost roughly 280ms on a machine without a
GPU, and about 28ms on one with a GPU?

## The measurement

Taken from the inspector e2e suite running on a GitHub `ubuntu-latest` runner
(4 vCPU, 16 GB, **no GPU**), CI run 36150785371:

| Phase of `Hierarchy.addChild` | Total across 28 calls | Share | Average |
| --- | --- | --- | --- |
| Open the context menu | 114.4s | 46.9% | 4086ms |
| **Type the label** | **100.4s** | **41.2%** | 3586ms |
| Commit (Enter, await the row) | 29.1s | 11.9% | 1041ms |

Typing broke down as 27.1s waiting for the input to take focus and **73.3s of
keystrokes across 262 characters — 280ms per character**. The same code on a
local Apple Silicon machine with a GPU costs about 28ms per character, a **10x
difference**.

The context-menu open, measured separately, split as row-wait 551ms, click
1387ms, menu paint 717ms.

## What has been ruled out

Each of these was tested, and none explains the gap:

- **CPU speed.** `Emulation.setCPUThrottlingRate` at 6x locally reproduced only
  a 1.4x slowdown (31.7s to 44.6s on `Hierarchy.spec.ts`). The cost does not
  scale with CPU, which is the signature of waiting rather than computing.
- **`slowMo`.** Removed from the suite entirely before these measurements.
- **Playwright actionability.** The right-click now uses `force: true`, which
  skips the stability and hit-test checks. That change alone took the suite
  from 10.3m to 6.5m on macOS, and the remaining cost is separate from it.
- **Retries.** Zero of 25 context-menu opens retried in the measured run.
- **Accumulated scene state.** `Hierarchy.spec.ts` runs at the same speed
  standalone as it does after the other specs have populated the tree.

## The leading hypothesis

Every keystroke re-renders the hierarchy tree, and without a GPU that render
rasterises on the CPU through SwiftShader. Two observations support it:

1. The gap tracks the presence of a GPU, not core count. The Linux runner is
   the *larger* machine (4 vCPU/16 GB against macOS arm64's 3 vCPU/7 GB) and is
   still about 47% slower end to end — 11.9m against 8.1m.
2. Within the context-menu open, the **menu paint is identical** across the two
   platforms (760ms on macOS, 785ms on Linux — that is `react-contexify`,
   plain DOM), while the **click grew 24%** (1465ms to 1813ms). The regression
   concentrates where rendering is involved.

This is a hypothesis, not a conclusion. Nobody has profiled the render path.

## Where to start

1. **Confirm the re-render.** Run the Inspector with React DevTools profiling
   and type into the entity-name input. Does each keystroke re-render the whole
   tree, or only the edited row? The entry points are
   `packages/inspector/src/components/Input/Input.tsx` (the controlled input the
   suite types into, matched by the `input.Input` selector) and
   `packages/inspector/src/components/Tree/Tree.tsx`, with the rename flow in
   `components/Tree/Edit/`.
2. **Check the controlled-input pattern.** `docs/coding-standards.md` has a
   section, "Don't mirror props into local state via `useEffect`", which
   describes the most common cause of exactly this. Verify whether the tree
   input does it.
3. **Separate render from React.** If the re-render is cheap but the frame is
   expensive, the cost is Babylon repainting the canvas. Compare a keystroke in
   the hierarchy panel against one in a UI Designer text field, which the same
   suite shows is fast — the UI Designer specs run at roughly the same speed on
   CI as locally, while the hierarchy specs run about 10x slower.
4. **Reproduce without CI.** Launch Chromium with `--disable-gpu
   --use-gl=swiftshader` on Linux. On macOS this does *not* reproduce the
   slowdown, because macOS retains a fast software path — so use Linux or a
   Linux container.

## Why it matters beyond the tests

The suite is the messenger, not the subject. A user editing entity names on a
laptop with weak or disabled graphics pays the same 280ms per keystroke. If the
cause is an avoidable re-render, fixing it improves the product and speeds the
suite as a side effect.

Conversely, do **not** "fix" this by changing the tests. Creating entities
through the engine API instead of the context menu was considered and rejected:
those 28 menu interactions are the coverage of the add-child flow, which is
what an end-to-end test exists to exercise.

## Reference

- Measurement commit and its removal: `3c7d20b36` added the `[e2e-diag]`
  timers, `413e091ab` removed them and recorded the result in
  `docs/testing-standards.md`.
- The forced right-click that removed the Playwright-side cost: `ce61a4e76`.
- CI runs: 36150785371 (Linux, with phase timers), 36144046470 (macOS, for the
  platform comparison).
