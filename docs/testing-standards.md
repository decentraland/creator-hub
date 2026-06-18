# Testing standards

Project-specific patterns for tests in this repo. See also: [coding-standards.md](./coding-standards.md).

## E2E (Playwright)

### Type with real keyboard events, not `locator.fill()`

Prefer `page.keyboard.type` / `page.keyboard.press` over `locator.fill()`.
Real users send per-character `keydown`/`input`/`keyup` events; `.fill()`
sets the value with a single synthetic event and bypasses any per-keystroke
state management. If a test only passes with `.fill()`, the underlying React
component has a bug — fix the component, not the test.

(See `coding-standards.md` → "Don't mirror props into local state via
`useEffect`" for the most common offender.)

### Use locators for actions that follow another mutation

A pre-fetched `ElementHandle` references a specific DOM node. If a re-render
replaces that node between the fetch and the action, the handle goes stale
and `.click()` fails with "Element is not attached to the DOM". Locators
re-resolve the selector at action time and pick up the live element:

```ts
// FRAGILE — handle captured before the action runs
const item = await page.$(itemSelector);
await item!.click({ button: 'right' });

// ROBUST — selector re-resolved at click time
await page.locator(itemSelector).first().click({ button: 'right' });
```

This matters especially for any action that immediately follows a mutation
(addChild, rename, delete) — the engine's CRDT propagation can still be
re-rendering the surrounding tree.

### Wait for `document.activeElement`, not just element-visible

For inputs that autofocus inside a `useEffect`, "visible" isn't enough. Mount
→ effect commit → `.focus()` is one more microtask hop after the element
appears in the DOM. If the test types before focus actually lands on the
input, the keystrokes hit `body`, and any `onBlur` handler on the input
(e.g. one that unmounts itself via `quitInsertMode`) will fire and remove
the field mid-test.

```ts
await page.locator('input.Input').first().waitFor({ state: 'visible' });
await page.waitForFunction(
  () =>
    document.activeElement instanceof HTMLInputElement &&
    document.activeElement.classList.contains('Input'),
);
await page.keyboard.type(value);
```

### Wait for the outcome, not a fixed delay

After a mutation, wait for the *result* selector (new row attached, deleted
row detached, label rendered) rather than `sleep(N)`. Fixed sleeps make slow
machines pass and fast machines miss races; outcome-waits scale with the
machine and self-document what the test is gating on.

Examples in `packages/inspector/test/e2e/pageObjects/Hierarchy.ts`:
`waitForLabel`, the post-`duplicate` count-change wait, the post-`remove`
detach wait.

### Run each E2E spec file in its own forked process

`vitest.e2e.config.js` uses `pool: 'forks'` with `singleFork: false` **and**
`fileParallelism: false`: each spec file runs in a fresh forked process, one at
a time. Do not set `singleFork: true` — sharing one long-lived worker across all
files accumulates Chromium/Babylon native memory until the CI runner kills the
process. The signature is `Error: Worker exited unexpectedly` at a *moving*
spec-file boundary (every test that ran passed; no V8 heap-OOM message) — it
reads like flakiness but is memory exhaustion, so raising `--max-old-space-size`
won't help. A fresh process per file reclaims memory; sequential execution keeps
only one headless Chromium alive at a time.
