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

By default the skill fetches each PR body and writes user-focused, product-ready summaries: a `###` block per feature, one-line bullets for changes and fixes. The internal asset-packs pipeline and component-versioning PRs are left out because they don't change the app. Example:

```markdown
## ✨ New & Improved

### Multi-Scene Worlds

Publish and manage worlds that contain multiple scenes. Assign collaborator permissions per world and build richer experiences from the Creator Hub.

### Placeholder component

Add a **Placeholder** component to represent invisible entities in the editor, such as sit spots or trigger areas, without rendering anything in the game. Design interactions without affecting scene metrics.

### Smart Items — Log & Delete actions

New actions let you log data and delete entities from your Smart Item logic, giving you more control over in-world behavior.

## 🔧 Changes

- The unused **Save** icon has been removed from the top bar for a cleaner interface.
- The "Slow connection" warning has been removed from the menu to reduce noise.
- The "Custom Code" warning is now more accurate, so you only see it when it's relevant.

## 🐛 Fixes

- **Trigger areas:** Trigger areas now activate only for the local player, so other players walking into the same zone no longer trigger it on your client.
- **Devtools:** The panel for inspecting your scene's web traffic works again, so you can debug network requests with confidence.
- **Virtual camera:** The duration field works as expected, and an entity can select itself in the **Change camera** action.
- **Smart Items:** Fixed the scale gizmo's white center and made the Photo-wall smart item more reliable.
```

Use the PR body to add context and benefits; keep tone friendly and suitable for release notes or product marketing. The Full Changelog link can be kept at the end if desired.
