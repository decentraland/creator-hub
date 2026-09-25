# Testing standards

Project-specific patterns for tests in this repo. See also: [coding-standards.md](./coding-standards.md).

## Writing a test

- Test framework: **Vitest** (not Jest, though patterns are similar). Tests use `describe`/`it`/`beforeEach`.
- Structure tests with `describe("when ...", () => { ... })` for context, `it("should ...", () => { ... })` for behavior.
  `shared/tests/flags.spec.ts` predates this and is flat — don't infer the convention from the nearest neighbour; `shared/tests/scene-parser.spec.ts` and `shared/tests/config.spec.ts` conform.
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

The creator-hub Playwright suite mirrors the layout of `decentraland/explorer-automation`
(`web/tests/marketplace`): page objects in `e2e/pages/` (a class per screen/modal,
`constructor(page)`), fixtures in `e2e/fixtures.ts`, cross-cutting helpers in `e2e/helpers/`, setup
projects in `e2e/setup/`, and all specs flat in `e2e/specs/` with the tier chosen by **tag**
(`@offline`/`@scene`/`@live`), not by folder. Specs construct page objects directly
(`new PublishModal(page)`) rather than injecting them as fixtures — the objects are lazy, so
per-test construction is free.

Each tier maps to an npm script (all drive the packaged app, so they build/package first):
`test:e2e` runs `@offline` + `@live` locally (`npm run compile` then Playwright); `test:e2e:ci` is
the CI form (packages with `electron-builder --dir` but skips the Vite rebuild that the
`download-build` action already provides) and runs **`@offline` only**; `test:e2e:ci:live` runs
`@live` against the app `test:e2e:ci` already packaged, and `e2e.yml` gates that step on
`github.event_name != 'pull_request'` — real `.zone` deploys must never run on a PR, and the
offline step is given no secrets at all; `test:e2e:live` runs only `@live` locally. **`@scene` is
deliberately not in those scripts** — creating a scene runs a live `npm install`, so it can fail on
registry outages rather than real regressions, which would make it a flaky PR gate. Run it on demand
with `test:e2e:scene`.

### Type with real keyboard events, not `locator.fill()`

Prefer `page.keyboard.type` / `page.keyboard.press` over `locator.fill()`. Real users send per-character `keydown`/`input`/`keyup` events; `.fill()` sets the value with a single synthetic event and bypasses any per-keystroke state management. If a test only passes with `.fill()`, the underlying React component has a bug — fix the component, not the test.

(See `coding-standards.md` → "Don't mirror props into local state via `useEffect`" for the most common offender.)

Budget for it: on the GPU-less Linux CI runner each character costs about
**280ms**, against roughly 28ms locally. Typing 262 characters across the
inspector suite's 28 `addChild` calls came to 100s — 14% of a 12-minute run.
The cost is the application, not Playwright: every keystroke re-renders the
hierarchy tree, and without a GPU that rasterises on the CPU. So keep labels in
fixtures short, and treat a long typed string in a test as a deliberate expense.
It is also a product signal — a user on weak hardware pays the same per
keystroke.

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

### The inspector suite boots one browser per worker, not per spec file

The inspector e2e runs on `@playwright/test` (`packages/inspector/playwright.config.ts`, chromium only), not vitest. A worker-scoped `auto` fixture in `test/e2e/fixtures.ts` launches one browser, boots the app once, and assigns it to `globalThis.page`, which is what every page object reads — so page objects need no `page` argument and no spec passes one. All spec files in a worker share that one boot: the suite went from ~430s to ~85s locally when it stopped paying a cold boot (Chromium launch + a ~55MB unminified dev bundle + Babylon init) per file.

Two consequences. A spec that navigates with extra params (`MobileHud`, `UIDesignerPanel` add `uiEditorEnabled`) MUST restore the base URL in `test.afterAll`, or it leaks that mode into every later file. And `slowMo` is gone: it was a global per-action delay used as a stability crutch, which inflated every one of the ~60 page-object actions. Stability now comes from auto-retrying assertions (`expect(locator)`, `expect.poll`) and the `actUntil`/`openThenSelect`/`revealThenClick` helpers, with `retries: 2` on CI so one flaky test costs seconds rather than a whole-job rerun.

### The `@live` tier signs in once, then seeds `localStorage`

`electron-live-auth` (`e2e/setup/auth.ts`) is a Playwright setup project that
`electron-live` declares as a `dependencies:` entry. It drives the real auth dapp once and writes
the signed-in renderer's whole `localStorage` to the gitignored `e2e/.auth/live-state.json`; every
`@live` test then gets it back through the `signedInLive` fixture (`seedLiveState` + reload). The
identity is a genuine `AuthIdentity` — a 2-link auth chain signed by `E2E_PRIVATE_KEY` — so it is
what a real deploy needs, not a mock.

Both live projects pass `appArgs: ['--env=dev']`, the `use` option that reaches `launchApp`. That
CLI flag (`main/src/modules/app-args-handle.ts`) points the app at `.zone`, so nothing a `@live`
run does touches mainnet Decentraland.

Neither project records a trace, video or screenshot: a `@live` run carries a real signed auth
chain and Playwright traces record request headers verbatim, so an uploaded artifact from this
public repo would publish the identity. The `electron-live` project defaults to `retries: 0`; only
the two publish specs opt into `test.describe.configure({ retries: 2 })` (see the deploy section
below), because a catalyst rejection is a transient infra blip on an atomic, idempotent deploy.

### `env=dev` must be on the login URL *and* its `redirectTo`

The app opens `https://decentraland.zone/auth/requests/<id>?…`, but `decentraland.zone` is behind
Cloudflare bot protection, so the setup rewrites it to `decentraland.org` (`authDappUrl`). The
dapp immediately redirects `/auth/requests/<id>` to `/auth/login?redirectTo=…` and **drops any
parameter it does not recognise on the way**. Put `env=dev` only on the request URL and the login
page runs in mainnet mode: it `POST`s the identity to `auth-api.decentraland.org`, which an app
started with `--env=dev` then cannot fetch (it reads `auth-api.decentraland.zone`), and sign-in
fails with a bare "identity not found". `watchAuthApi(...).assertTestnetBackend()` exists to make
that fail loudly instead — it trips on the mainnet `/health/live` probe, before the identity is
even stored.

### Sign the auth dapp in with an injected provider, not a wallet extension

`setupTestWallet` (`e2e/helpers/wallet-setup.ts`) injects an EIP-1193 provider that announces
itself over EIP-6963 as MetaMask, which is what makes the dapp's "Continue with MetaMask" button
appear. `personal_sign` / `eth_signTypedData_v4` are forwarded through `page.exposeFunction` to
viem's `privateKeyToAccount` in the test process, so signatures are real and `E2E_PRIVATE_KEY`
never enters the page.

Synpress 4.1.2 was tried first and does not work here. Its MetaMask automation pins MetaMask
13.13.1, whose redesigned account list has no reachable private-key import: `importWalletFromPrivateKey`
targets `multichain-account-menu-popover-action-button`, which no longer exists; the replacement
`account-list-add-wallet-button` is permanently `disabled` behind an account-sync spinner, and the
old `#new-account/import` route renders an empty shell. (Its `importWallet` seed onboarding does
work, but it ends parked on `#onboarding/completion` — the Done button commits onboarding in the
background service worker and never routes away, so the home page is only reachable by reloading.)
Synpress's other option, `@synthetixio/ethereum-wallet-mock`, only mocks the *address*: it has no
key in the page and cannot produce a signature a catalyst would accept.

### The publish `@live` specs deploy for real

`e2e/specs/publish-to-world.spec.ts` and `publish-to-land.spec.ts` create a scene and run a
genuine `.zone` deployment with the `.env.e2e` wallet, then stop at the point the content server has
**accepted** it. Acceptance has two possible renderings and the spec waits for whichever arrives:

```ts
'[data-testid="publish-modal-deploy-step-uploading"][data-state="complete"]',
'[data-testid="publish-modal-deploy-success"]',
```

Matching only the first is a race. One `fetchDeploymentStatus` response sets every component at once, so
when the bundles are already warm the catalyst and asset-bundle steps flip in the same poll,
`checkDeploymentStatus` sees `allSuccessful`, the thunk fulfils and `Success` replaces `Deploying` — the
upload step at `complete` is never painted. A LAND deploy whose bundles lag does paint it, so a spec
gated on that alone passes for LAND and hangs for a World that deployed perfectly.

Do **not** assert `publish-modal-deploy-success` on its own. That screen renders only when
`deriveOverallStatus` finds every component `complete`, and those components include the asset-bundle
conversion and (for LAND) LOD generation — pipelines that run *after* the deployment is accepted, on
their own schedule. A World masks this because `fetchDeploymentStatus` hardcodes
`lods: isWorld ? 'complete' : …`, so only the bundles gate it; a LAND deploy observed on `.zone` had
`catalyst` and both asset bundles `complete` while `lods` stayed `pending` for over 45 minutes, which
is the app behaving correctly, not the deploy failing. Gating the suite on that turns someone else's
queue depth into a red test.

`ConnectedSteps` is what exposes the signal: `Step` renders `data-state` plus the `testId` its caller
supplies, and `Deploy` names them `publish-modal-deploy-step-{unpublishing,uploading,converting,optimizing}`.
The error screen carries `publish-modal-deploy-error`; `deployToAccepted` races it against the
acceptance locators so a rejected deploy fails in seconds (throwing the error text) instead of
burning the whole timeout. It does **not** drive the app's own "Retry" button: `handleDeployRetry`
calls `onBack()`, which navigates back to the target-selection step rather than re-running the
deploy in place — so a loop that clicked it then waited on the deploy screen hung the full 600s.
The catalyst rejects `~1/3` of Genesis City deploys transiently (a World via WCS almost never), and
a catalyst deploy is atomic and idempotent, so the recovery is a clean full re-run: `publish-to-land`
and `publish-to-world` set `test.describe.configure({ retries: 2 })`. `signed-in` stays at 0.

To see where a deployment actually is, read the registry rather than the UI:
`GET <asset-bundle-registry>/entities/status/<entityId>` (signed with the same auth chain) returns
`{catalyst, assetBundles: {mac, windows}, lods: {mac, windows}, complete}`.

`E2E_NAME` is the **full subdomain** (`<label>.dcl.eth`). The marketplace subgraph stores the bare
label and `DCLNames.fetchNames` appends the suffix, so the NAME's option carries the testid
`publish-modal-publish-to-world-select-world-select-item-<label>.dcl.eth`.

`PublishToLand` has no parcel picker to click — the grid is a `<canvas>` `Atlas`. The step
auto-places the scene instead: `getInitialPlacement` falls back to `Object.keys(landTiles)[0]`
because a new scene's `scene.base` is `0,0`, which the wallet does not hold. So the spec asserts
that the placement label names `E2E_LAND` rather than hitting a tile, which is exact only while the
wallet owns exactly one parcel. Give it a second parcel and the spec has to compute canvas pixels.

The `publish-modal-*` testids `PublishToLand` exposes: `publish-modal-publish-to-land` (the step
body), `-atlas` (the canvas container), `-placement` (the label carrying the chosen coords),
`-reset`, and `-action` (publish).

Two publish testids sit on a **container**, not on the control: `publish-modal-deploy-publish-button`
is the file-list wrapper and `publish-modal-initial-option-box-{worlds,land}` is the `OptionBox`
root. Clicking either locator directly hits dead space — append ` button`.

### The `@live` name list tolerates a flaky ENS subgraph

`fetchENSList` unwraps three sources together — DCL/marketplace names, ENS/`ens-sepolia`, and
contributable names — all-or-nothing, so when `ens-sepolia` answers `500` the World name picker
never populates and publish-to-World is blocked (for real users too, not just the test). The `.zone`
`ens-sepolia` subgraph is intermittently down. `publish-to-world.spec.ts` therefore preflights it in
`beforeEach` (`ensSubgraphAvailable`, a `{ _meta { block { number } } }` probe) and `test.skip`s with
a subgraph-is-down message instead of failing red: a green run means the deploy really happened, a
skipped one means the dependency was out. Making the app degrade gracefully when one name source
fails is a separate, open app-side ticket.

### `E2E_APP_PATH` selects the packaged app

`resolvePackagedApp` drives the packaged artifact, not `electron .`. Locally it walks
`dist/mac*/…app/Contents/MacOS/<binary>`; in CI the app comes from the release job's artifact,
extracted outside `dist`, so `E2E_APP_PATH` overrides the search — and accepts either the `.app`
bundle or the executable inside it.

### Wait out the install `Backdrop` before driving the inspector iframe

The app shows a MUI `<Backdrop>` over a freshly created scene while it installs. Asserting
`toHaveCount(0)` on `.MuiBackdrop-root` never passes — MUI keeps the node mounted and only toggles
visibility — so the backdrop silently swallows clicks routed to the in-iframe file input. Gate on
`.MuiBackdrop-root:visible` reaching count 0 instead.
