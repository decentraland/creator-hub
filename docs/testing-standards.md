# Testing standards

Project-specific patterns for tests in this repo. See also: [coding-standards.md](./coding-standards.md).

## Writing a test

- Test framework: **Vitest** (not Jest, though patterns are similar). Tests use `describe`/`it`/`beforeEach`.
- Structure tests with `describe("when ...", () => { ... })` for context, `it("should ...", () => { ... })` for behavior.
- Scope mocks and test data to the specific `describe` block that needs them (not globally).
- Variables and mocks go in `beforeEach`, cleanup in `afterEach`.
- React: use `@testing-library/react` with accessible queries (`getByRole`, `getByLabelText`).
- E2E: Playwright for both Electron app and web inspector.

Write the failing test first. When a test had to be written after the fact,
prove it can still fail by stashing the implementation and re-running it —
a test that has never been red is not evidence of anything:

```bash
git stash push -- packages/creator-hub/renderer/src/lib/land.ts
npm run test:renderer -- src/lib/land.spec.ts   # must fail here
git stash pop
```

## Unit tests (Vitest)

### `vi.mock` with a factory replaces the whole module

A `vi.mock(path, () => ({ ... }))` factory is the *entire* module from then on;
anything the real module exports but the factory omits becomes `undefined`. That
turns adding an export to a source file into a failure in a spec that never
mentioned it. Sometimes vitest names the problem:

```
Error: [vitest] No "getWorldSettingsInitialState" export is defined on the "../management/utils" mock.
```

but when the missing export is only *called* rather than read at import time, it
fails as a plain `TypeError` deep inside whatever awaited it — a rejected thunk
surfacing as `expected [] to have a length of 1`, with nothing pointing at the
mock. Prefer a partial mock, which keeps the real module and overrides only what
the test needs:

```ts
vi.mock('./utils', async importOriginal => ({
  ...(await importOriginal<ManagementUtils>()),
  fetchWorldSceneCoords: vi.fn(async () => [{ x: 0, y: 0 }]),
}));
```

Note that `importOriginal` does **not** intercept same-module calls: a function
kept real still calls its real neighbours, not their mocked versions.

A module mocked this way also loses its **default** export unless the factory
provides one. `lib/worlds` does `import fetch from 'decentraland-crypto-fetch'`,
so a factory without a `default` leaves every worlds request calling `undefined`
— surfacing as `Failed to fetch worlds` with zero fetch calls recorded, and
nothing naming the mock:

```ts
vi.mock('decentraland-crypto-fetch', () => ({
  default: (input: RequestInfo | URL, init?: RequestInit) => globalThis.fetch(input, init),
  signedHeaderFactory: () => () => new Map(),
}));
```

`importOriginal<T>()` takes a namespace type import
(`import type * as Utils from './utils'`), but only for modules that declare
their own exports. A barrel that re-exports with `export *` (`../Navbar`,
`modules/store/land`) fails `TS2709: Cannot use namespace as a type`; there,
drop the generic and spread `(await importOriginal()) as object`.

### Rendering a page component needs a theme, and no navbar

`decentraland-ui2` components read theme tokens through emotion, so a bare
`render()` throws before the page under test appears. Wrap in
`ThemeProvider theme={dark}` from `decentraland-ui2/dist/theme`, plus
`MemoryRouter` for anything calling `useNavigate`.

That is still not enough for a page carrying the navbar: `AvatarFace` reads a
palette slice this environment does not populate and throws
`Cannot read properties of undefined (reading 'secondary')` from
`AvatarFace.styled.ts` — a stack that names neither your test nor your page.
Stub the component and keep the enum:

```ts
vi.mock('../Navbar', async importOriginal => ({
  ...((await importOriginal()) as object),
  Navbar: () => null,
}));
```

### Type `importOriginal` with a namespace import, not `typeof import()`

`@typescript-eslint/consistent-type-imports` rejects inline `import()` type
annotations, so the obvious `importOriginal<typeof import('./utils')>()` fails
lint with ``  `import()` type annotations are forbidden``. Import the namespace as
a type instead — it is erased at runtime, so it is safe inside a hoisted
`vi.mock` factory:

```ts
import type * as ManagementUtils from './utils';
```

### Vitest fake timers leak across `describe` blocks

`vi.useFakeTimers()` in one `describe` stays in effect for every later
`describe` in the same file — vitest does not reset it between blocks. A later
test that awaits a real `setTimeout` (a retry/backoff helper, a debounced
promise) then hangs to the 5s test timeout with no indication why.
`packages/creator-hub/shared/tests/utils.spec.ts` is the live case: the
`debounce` and `debounceByKey` suites enable them and never restore, so anything
added below needs its own `beforeEach(() => vi.useRealTimers())`.

### `getByRole` does not work inside the shared `Block` wrapper

Under happy-dom the whole subtree reports "There are no accessible roles", and
`hidden: true` does not rescue it. Every UI Designer panel field renders inside a
`Block`, so query those by label (`getByLabelText`) or with
`querySelector('[role="…"]')` — see `FlowField.spec.tsx`, `CallbackField.spec.tsx`.
`getByRole` is fine on a bare control (`Pill.spec.tsx`).

### Asset-packs circular imports & vitest

`packages/asset-packs/src/definitions.ts` re-exports every internal module via
`export * from './...'`. Production bundlers hoist these bindings, but the
Vitest loader resolves the re-export *before* the leaf module finishes
evaluating — so importing constants like `COMPONENTS_WITH_ID` or `getNextId`
through `definitions.ts` will see them as `undefined` at call time inside the
same source tree. In `asset-packs` source files and tests, import these
constants from the leaf module directly (`from './id'`, `from './types'`,
etc.) rather than via the `definitions.ts` barrel.

## E2E (Playwright)

### Type with real keyboard events, not `locator.fill()`

Prefer `page.keyboard.type` / `page.keyboard.press` over `locator.fill()`. Real users send per-character `keydown`/`input`/`keyup` events; `.fill()` sets the value with a single synthetic event and bypasses any per-keystroke state management. If a test only passes with `.fill()`, the underlying React component has a bug — fix the component, not the test.

(See `coding-standards.md` → "Don't mirror props into local state via `useEffect`" for the most common offender.)

### Use locators for actions that follow another mutation

A pre-fetched `ElementHandle` references a specific DOM node. If a re-render replaces that node between the fetch and the action, the handle goes stale and `.click()` fails with "Element is not attached to the DOM". Locators re-resolve the selector at action time and pick up the live element:

```ts
// FRAGILE — handle captured before the action runs
const item = await page.$(itemSelector);
await item!.click({ button: 'right' });

// ROBUST — selector re-resolved at click time
await page.locator(itemSelector).first().click({ button: 'right' });
```

This matters especially for any action that immediately follows a mutation (addChild, rename, delete) — the engine's CRDT propagation can still be re-rendering the surrounding tree.

### Wait for `document.activeElement`, not just element-visible

For inputs that autofocus inside a `useEffect`, "visible" isn't enough. Mount → effect commit → `.focus()` is one more microtask hop after the element appears in the DOM. If the test types before focus actually lands on the input, the keystrokes hit `body`, and any `onBlur` handler on the input (e.g. one that unmounts itself via `quitInsertMode`) will fire and remove the field mid-test.

```ts
await page.locator('input.Input').first().waitFor({ state: 'visible' });
await page.waitForFunction(
  () =>
    document.activeElement instanceof HTMLInputElement &&
    document.activeElement.classList.contains('Input'),
);
await page.keyboard.type(value);
```

### `ui/TextField` reports through a debounce

`TextField` routes `onChange` through `debounce(onChange, debounceTime ?? 0)`. A 0ms debounce is still a `setTimeout`, so the value lands on the NEXT tick: a `fireEvent.change(...)` followed by a synchronous assertion reads the stale value.

Drive it with a controlled clock rather than `waitFor` — for an "expect absent" assertion `waitFor` can pass before the update lands at all:

```ts
vi.useFakeTimers();
fireEvent.change(input, { target: { value: term } });
act(() => {
  vi.advanceTimersByTime(1);
});
```

See `UIDesignerLeftRail.spec.tsx`.

### Wait for the outcome, not a fixed delay

After a mutation, wait for the _result_ selector (new row attached, deleted row detached, label rendered) rather than `sleep(N)`. Fixed sleeps make slow machines pass and fast machines miss races; outcome-waits scale with the machine and self-document what the test is gating on.

Examples in `packages/inspector/test/e2e/pageObjects/Hierarchy.ts`: `waitForLabel`, the post-`duplicate` count-change wait, the post-`remove` detach wait.

### `.App.is-ready` is the readiness contract

`App.tsx` puts `is-ready` on the root element, and every spec gates on it via `App.waitUntilReady()` (`waitForSelector('.App.is-ready')`). Specs then act immediately — `Hierarchy.spec.ts` calls `addChild(ROOT, …)` in the very next statement.

So anything that delays the **first mount** of a panel a spec touches must be folded into that flag. When the UI Designer gained a persisted 2D/3D mode, neither `Hierarchy` nor the designer mounted until the mode arrived from the scene composite; leaving `is-ready` on sdk-init alone would have raced every hierarchy spec.

The class carries no styling — it exists purely as this signal, which makes it look safe to ignore.

### Run each E2E spec file in its own forked process

`vitest.e2e.config.js` uses `pool: 'forks'` with `singleFork: false` **and** `fileParallelism: false`: each spec file runs in a fresh forked process, one at a time. Do not set `singleFork: true` — sharing one long-lived worker across all files accumulates Chromium/Babylon native memory until the CI runner kills the process. The signature is `Error: Worker exited unexpectedly` at a _moving_ spec-file boundary (every test that ran passed; no V8 heap-OOM message) — it reads like flakiness but is memory exhaustion, so raising `--max-old-space-size` won't help. A fresh process per file reclaims memory; sequential execution keeps only one headless Chromium alive at a time.
