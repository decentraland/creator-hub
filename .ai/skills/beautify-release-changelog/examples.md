# Full example: What's Changed to beautified changelog

## Input (raw GitHub "What's Changed")

```markdown
## What's Changed

- trigger area activates only on your player by @nearnshaw in https://github.com/decentraland/creator-hub/pull/1142
- Scale gizmo white center fix by @nearnshaw in https://github.com/decentraland/creator-hub/pull/1082
- remove save icon by @nearnshaw in https://github.com/decentraland/creator-hub/pull/1152
- Smart item fixes by @nearnshaw in https://github.com/decentraland/creator-hub/pull/1110
- Log & delete actions by @nearnshaw in https://github.com/decentraland/creator-hub/pull/1131
- fix: Devtools by @cyaiox in https://github.com/decentraland/creator-hub/pull/1109
- placeholder component by @nearnshaw in https://github.com/decentraland/creator-hub/pull/1154
- fix: Upload asset-packs pipeline by @cyaiox in https://github.com/decentraland/creator-hub/pull/1170
- fix: slow connection warning removed by @kevindecibe in https://github.com/decentraland/creator-hub/pull/1169
- fix: fix virtual camera component and select camera action by @alejandralevy in https://github.com/decentraland/creator-hub/pull/1160
- Backup/components versioning tmp by @alejandralevy in https://github.com/decentraland/creator-hub/pull/1167
- fix: custom code detection updated by @kevindecibe in https://github.com/decentraland/creator-hub/pull/1171
- feat: Multi-Scene Worlds by @RocioCM in https://github.com/decentraland/creator-hub/pull/1089

**Full Changelog**: https://github.com/decentraland/creator-hub/compare/0.33.1...0.34.0
```

## Output (default: verbose, user-friendly, product-ready)

By default the skill fetches each PR body and writes user-focused, product-ready summaries (bold label + short description). Example:

```markdown
## New features

- **Multi-Scene Worlds** — Publish and manage worlds that contain multiple scenes. Assign collaborator permissions per world and build richer experiences from the Creator Hub.

- **Placeholder component** — Add a "Placeholder" component to represent invisible entities in the editor (e.g. sit spots, trigger areas) without rendering anything in the game, so you can design interactions without affecting scene metrics.

- **Log & Delete actions in Smart Items** — New actions let you log data and delete entities from your Smart Item logic, giving you more control over in-world behavior.

## Fixes

- **Trigger areas** — Trigger areas now activate only for the local player when they enter, so other players walking into the same zone no longer trigger it on your client.

- **Devtools** — The Devtools panel for inspecting your scene’s web traffic is working again; you can debug network requests and preview behavior with confidence.

- **Virtual camera** — The duration field now works as expected, and an entity can select itself in the "Change camera" action for smoother cutscenes and camera transitions.

- **Scale gizmo** — The white center of the scale gizmo is fixed for clearer visual feedback while resizing entities.

- **Save icon** — The unused "Save" icon has been removed from the top bar for a cleaner interface.

- **Photo-wall smart item** — Fixes applied to the Photo-wall smart item for more reliable behavior.

- **Slow connection warning** — The "Slow connection" warning has been removed from the menu to reduce noise.

- **Custom Code warning** — The "Custom Code" warning is now more accurate so you only see it when relevant.

- **Asset-packs pipeline** — The upload asset-packs pipeline has been fixed for more reliable publishing.

- **Component versioning** — More robustness when updating dependency versions thanks to clear versioned component types; fewer surprises when upgrading.
```

Use the PR body to add context and benefits; keep tone friendly and suitable for release notes or product marketing. The Full Changelog link can be kept at the end if desired.

---

# Example 2: collapsing a stack and dropping non-user-facing PRs

This case shows the two hardest judgment calls: a **10-PR feature stack** that must
become **one** bullet, and a **CI-only PR** that must be **dropped** entirely.

## Input (raw GitHub "What's Changed")

```markdown
## What's Changed

* fix: poll the rootCID that was actually deployed after a catalyst retry by @RocioCM in https://github.com/decentraland/creator-hub/pull/1496
* fix: Analytics list silently dropped deployed scenes by @cyaiox in https://github.com/decentraland/creator-hub/pull/1492
* fix: publish to World confirm button stuck disabled in Bevy editor by @nearnshaw in https://github.com/decentraland/creator-hub/pull/1493
* fix: prevent Windows NSIS auto-update stall by capping before-quit cleanup time by @decentraland-bot in https://github.com/decentraland/creator-hub/pull/1497
* chore: remove Legacy Web Editor card and update Names link in More tab by @nearnshaw in https://github.com/decentraland/creator-hub/pull/1495
* chore: cache node_modules and skip wasteful typecheck build by @cyaiox in https://github.com/decentraland/creator-hub/pull/1316
* fix: refresh ENS names list on publish modal open and Manage/Analytics tabs by @nearnshaw in https://github.com/decentraland/creator-hub/pull/1509
* feat: add Friendzone Buildathon 2026 videos to Learn section by @nearnshaw in https://github.com/decentraland/creator-hub/pull/1510
* feat: add Avatar Modifier Area and Camera Modifier Area support by @nearnshaw in https://github.com/decentraland/creator-hub/pull/1471
* build(ui-designer): tooling, deps, docs, bevy-agent rebuild by @cyaiox in https://github.com/decentraland/creator-hub/pull/1516
* refactor(inspector): shared-UI primitives + a11y by @cyaiox in https://github.com/decentraland/creator-hub/pull/1517
* feat(inspector): code-as-source parse/emit engine by @cyaiox in https://github.com/decentraland/creator-hub/pull/1518
* feat(ui-designer): code-as-source model + shared helpers by @cyaiox in https://github.com/decentraland/creator-hub/pull/1519
* feat(ui-designer): left panel (nodes tree) by @cyaiox in https://github.com/decentraland/creator-hub/pull/1520
* feat(ui-designer): properties (right) panel by @cyaiox in https://github.com/decentraland/creator-hub/pull/1521
* feat(ui-designer): direct-manipulation canvas by @cyaiox in https://github.com/decentraland/creator-hub/pull/1522
* feat(ui-designer): shell, 2D/3D mode switch, and app wiring by @cyaiox in https://github.com/decentraland/creator-hub/pull/1523
* feat(creator-hub): gate UI Designer behind experimental opt-in by @cyaiox in https://github.com/decentraland/creator-hub/pull/1524
* feat(ui-designer): track UI Editor enable and designer usage by @cyaiox in https://github.com/decentraland/creator-hub/pull/1530

**Full Changelog**: https://github.com/decentraland/creator-hub/compare/0.44.2...0.45.0
```

## Output (house style — two sections)

```markdown
## New features

- **UI Editor (experimental)** — Design your scene's on-screen interface visually, right in the Creator Hub. The new UI Designer gives you a live 2D canvas with a nodes tree and a full properties panel (layout, fill, text, callbacks, bindable fields), keeping your `@dcl/react-ecs` code as the single source of truth so design and code never drift apart. Turn it on in Settings → Experimental ("UI Editor", off by default); requires SDK 7.26.0+.
- **Avatar & Camera Modifier Areas** — Two new components let you change how avatars appear and how the camera behaves inside a region of your scene. Add them from the **Add Component** menu or drop them in as ready-made smart items, and size each area just by scaling the entity.
- **Friendzone Buildathon 2026 workshops** — The full four-part workshop series (Creator Hub, Building for Mobile, Mobile UX & Controls, and Performance/VFX) is now a playlist in **Learn → Videos**, with the first two workshops featured on the Home page.

## Fixes

- **Publishing to LAND no longer hangs** — Publishing could sit on "Publishing…" forever with no error, even though your scene was already live. It now tracks the deployment that actually landed and correctly reports success.
- **Publishing to a World from the Bevy editor** — The confirm button could stay grayed out forever, making it impossible to publish from the Bevy editor. It now enables as expected.
- **Analytics shows all your scenes** — The Analytics page could silently drop scenes, showing a different subset on each load. It now reliably lists every deployed World and Genesis City scene.
- **NAMES stay up to date** — Newly purchased NAMEs, and worlds you've just been granted deploy access to, now appear right away instead of requiring an app restart.
- **Windows auto-update reliability** — Fixed the recurring *"Creator Hub cannot be closed"* dialog that forced Windows users to kill processes or reinstall to update.
- **Cleaner "More" tab** — Removed the retired Legacy Web Editor card, and the **Names** card now links directly to the marketplace shop.

**Full Changelog**: https://github.com/decentraland/creator-hub/compare/0.44.2...0.45.0
```

### Why the output looks like this

- **Nine PRs (#1516–#1524, #1530) collapsed into one "UI Editor" bullet.** They are a
  dependency-ordered stack for a single feature; most say "no user-facing change on its
  own." A reader wants the shipped capability, not the layering.
- **The CI PR (#1316, "cache node_modules…") is dropped.** It has no perceivable user
  impact, so it does not appear at all — no "Behind the scenes" section is invented for it.
- **The "More" tab cleanup (#1495) folds into Fixes**, not a separate Improvements section.
- Everything else is one user-facing bullet per PR, benefit-first.
