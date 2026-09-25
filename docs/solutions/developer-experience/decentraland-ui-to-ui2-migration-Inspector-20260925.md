# Migrating the Inspector from decentraland-ui to decentraland-ui2

The Inspector still renders through `decentraland-ui` v6, which is built on
Semantic UI. The Creator Hub renderer already uses `decentraland-ui2`, which
is built on MUI. This document is the handoff plan for moving the Inspector
onto `decentraland-ui2` so both packages share one design system.

The surface is much smaller than it looks: 11 files import from
`decentraland-ui`, and between them they use six components. The work is
mostly mechanical, with one genuine blocker.

## Why this is worth doing

Three reasons, in order of how much they matter.

- **One design system.** The Creator Hub embeds the Inspector in an iframe, so
  today a user sees Semantic UI and MUI side by side in the same window.
- **Test stability.** Semantic UI's `Popup` positions itself after mount, which
  makes it measure-then-move. The inspector e2e suite has a tooltip placement
  test (`Assets.spec.ts`, "Name tooltip sits right above the tile") that flakes
  roughly one run in six because of it. MUI's `Popper` uses Popper.js, which
  reports a settled position.
- **Bundle size.** `src/index.tsx` imports `decentraland-ui/lib/styles.css`
  globally. That file is 824 KB of Semantic UI CSS covering every Semantic
  component, not just the six in use.

<!-- prettier-ignore -->
> [!NOTE]
> Removing the global stylesheet is the single highest-value step, and it is
> also the one most likely to cause visual regressions, because unrelated
> elements may be inheriting Semantic's base styles without importing a
> Semantic component.

## What the Inspector actually uses

Every import of `decentraland-ui` in `packages/inspector/src`, as of
September 25, 2026:

| File | Imports |
| --- | --- |
| `index.tsx` | `lib/styles.css`, `lib/dark-theme.css` |
| `components/ui/InfoTooltip/InfoTooltip.tsx` | `Popup` |
| `components/ui/InfoTooltip/types.ts` | `PopupProps` (type) |
| `components/Loading/Loading.tsx` | `Loader`, `Dimmer` |
| `components/Loading/types.ts` | `SemanticSIZES` (type) |
| `components/CreateCustomAsset/CreateCustomAsset.tsx` | `Loader` |
| `components/AssetsCatalog/Asset/AssetContainer.tsx` | `Popup`, `PopupContent` |
| `components/ProjectAssetExplorer/Tile/Tile.tsx` | `Loader` |
| `components/AssetPreview/AssetPreview.tsx` | `WearablePreview` |
| `components/AssetPreview/AssetPreview.spec.tsx` | `vi.mock('decentraland-ui')` |

One more file is already on the new library: `hooks/useSnackbar.ts` imports
`AlertColor` from `decentraland-ui2`.

## Component mapping

`decentraland-ui2` re-exports all of `@mui/material` (see
`export * from "@mui/material"` in its `dist/index.d.ts`), so every MUI
component below is available directly from `decentraland-ui2` without adding
`@mui/material` as a dependency.

| Semantic (current) | MUI replacement | Notes |
| --- | --- | --- |
| `Loader` | `CircularProgress` | Three call sites, all decorative spinners. |
| `Dimmer` | `Backdrop` | One call site, wraps the loader in `Loading.tsx`. |
| `Popup` | `Tooltip` or `Popper` | Use `Tooltip` for hover labels; use `Popper` where the content is interactive. |
| `PopupContent` | Children of `Tooltip`'s `title` | No direct equivalent; MUI takes content as a prop. |
| `SemanticSIZES` | `'small' \| 'medium' \| 'large'` | MUI sizes are a narrower union than Semantic's. Audit the call sites. |
| `WearablePreview` | **None** | See the blocker below. |

## The one blocker: WearablePreview

`WearablePreview` is a Decentraland-specific component, not a Semantic UI
primitive, and `decentraland-ui2` does not export it. It renders the wearable
preview iframe in `components/AssetPreview/AssetPreview.tsx`.

You have three options, and the choice needs a decision from whoever owns
`decentraland-ui2`:

1. **Port `WearablePreview` into `decentraland-ui2`.** The cleanest outcome,
   and it unblocks any other consumer with the same problem. It is also the
   slowest, because it needs a release of that library.
2. **Keep `decentraland-ui` as a dependency solely for this component.** The
   Inspector keeps one Semantic import but drops the global stylesheet. You
   must verify that `WearablePreview` renders acceptably without
   `decentraland-ui/lib/styles.css`; if it does not, import only the CSS it
   needs.
3. **Inline the component.** `WearablePreview` is largely an iframe wrapper
   around the wearable preview service. Copying it into the Inspector removes
   the dependency entirely but forks the implementation.

<!-- prettier-ignore -->
> [!IMPORTANT]
> Do not start the migration by deleting the `decentraland-ui` dependency.
> Decide the `WearablePreview` strategy first, because option 2 keeps the
> dependency and changes the shape of every later step.

## Fix this first: the phantom dependency

`packages/inspector/src/hooks/useSnackbar.ts` imports from
`decentraland-ui2`, but `packages/inspector/package.json` does not declare
`decentraland-ui2` as a dependency. It resolves today only because npm
workspaces hoist it from `creator-hub` into the root `node_modules`.

This is a latent break: if `creator-hub` drops or renames that dependency, the
Inspector stops compiling for a reason that has nothing to do with the
Inspector. Declare it explicitly before you add more imports:

```bash
cd packages/inspector
npm i --save-exact decentraland-ui2@0.23.1
```

Match the version `creator-hub` pins, so the workspace resolves a single copy.

## Suggested sequence

Each step is independently shippable and independently revertible. Ship them as
separate pull requests.

1. **Declare `decentraland-ui2` in the Inspector.** One line in
   `package.json`, no source changes. This is the phantom dependency fix above.
2. **Replace `Loader` and `Dimmer`.** Four call sites across three files, all
   decorative. `SemanticSIZES` disappears with `Loading/types.ts`. This is the
   lowest-risk step and proves the theme integrates.
3. **Replace `Popup` and `PopupContent`.** Two files. Update
   `Assets.getNameTooltipPlacement` in the e2e page object at the same time:
   its `.ui.popup.InfoTooltip` selector is Semantic-specific and will stop
   matching. This step should fix the tooltip flake.
4. **Resolve `WearablePreview`** using whichever option you chose above.
   Update the `vi.mock('decentraland-ui')` factory in `AssetPreview.spec.tsx`
   to match.
5. **Remove the global stylesheet.** Delete the two CSS imports from
   `index.tsx` and verify the Inspector visually. Expect to re-add styles that
   were silently inherited. Do this last, and on its own, so a visual
   regression is easy to bisect.

## Verification

Run these from the repository root after each step:

```bash
make typecheck
make test
npx eslint "packages/inspector/src/**/*.tsx"
```

The last command matters because `make lint` runs
`eslint . --ext js,cjs,ts` and does not cover `.tsx` files, which is where
nearly all of this work lands.

For steps 3 and 5, also run the Inspector e2e suite, which needs a dev server:

```bash
cd packages/inspector
node ./build.js
npx http-server public -p 8000 --cors -a localhost &
npm run test:e2e
```

The suite takes about 85 seconds and must stay at 56 passing. Run it at least
twice after step 3 to confirm the tooltip test no longer flakes.

## What this does not cover

Two other UI libraries live in the Inspector and are out of scope here:

- `react-contexify` provides the right-click menus (`.contexify_item`). MUI's
  `Menu` is a plausible replacement, but the menus are used heavily in the
  hierarchy tree and deserve their own assessment.
- `react-dnd` handles drag and drop across 17 files. It has no MUI equivalent
  and should stay.

## Next steps

Decide the `WearablePreview` strategy, then open the step 1 pull request. The
theme wiring in step 2 is the real proof point: if `decentraland-ui2`'s
`DclThemeProvider` composes cleanly with the Inspector's existing
`theme/vars.css`, the rest of the migration is mechanical.
