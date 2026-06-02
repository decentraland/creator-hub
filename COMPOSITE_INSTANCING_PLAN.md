# Plan: Nested Composites, Sub-Composite Editing & Template/Instance Overrides

> Status: **DRAFT for review** — edit freely. Owner: @nearnshaw
> Branch: `edit-asset`

## 1. Goal

Today you can switch which composite file the inspector edits, but only through the
new dropdown (`CompositeSelector`), and each composite is edited in isolation. We want
to turn composites into **reusable templates that can be nested and instanced**, with a
clear, deliberate distinction between editing the *template* (affects all instances) and
editing a single *instance* (a local override).

Concretely, for a scene like:

```
Scene
  House          ← an instance of House.composite
    Table        ← an instance of Table.composite
    Table        ← another instance of the SAME Table.composite
```

We want to be able to:

1. **Open a sub-composite from the entity tree** (e.g. open `House`, edit it, return to the
   main scene and see the changes) — not just from the dropdown.
2. **Nest composites** (House contains Tables; Tables can be opened too).
3. **Propagate template edits to all instances** — change `Table.composite` and *both*
   tables update.
4. **Override a single instance** — change *this* table without affecting the others, with a
   clear visual signal that the value is overridden.
5. **Revert an instance to template defaults** — undo all local overrides.
6. **Stop flattening on instance** — keep a live reference back to the source composite
   instead of copying all entities into the main composite (today's behavior).

**We take direct inspiration from Godot's instanced-scene UX** (see §3). Godot solves
exactly this problem — instancing a scene file into another scene, opening it for editing,
overriding individual properties on one instance, and reverting them — with a small, proven
set of affordances. We borrow those *interaction patterns*, but **keep our own element names**
(`composite`, `entity`) — we do **not** rename anything to Godot's "scene" / "node".

---

## 2. Current state (what exists today)

### 2.1 The composite model (from `@dcl/ecs`)
- A composite is a `Composite.Definition`: `{ version, components: CompositeComponent[] }`,
  stored on disk as `.composite` / `.composite.json` (JSON) or `.composite.bin` (binary).
- **`CompositeRoot` is the SDK's native nesting mechanism.** An entity carrying the
  `CompositeRoot` component holds `{ src: string, entities: { src, dest }[] }` — a reference
  to another composite file plus an entity-id mapping. **This is the key primitive we
  should build on.** It already exists; we are mostly not using it from the inspector.
- `Composite.instance(engine, resource, manager, { entityMapping })` loads a composite into
  the engine, recursively resolving `CompositeRoot` children via the `CompositeManager`.

### 2.2 The new dropdown (this branch, `edit-asset`)
- UI: [CompositeSelector/component.tsx](packages/creator-hub/renderer/src/components/CompositeSelector/component.tsx)
  + modals [CreateComposite](packages/creator-hub/renderer/src/components/Modals/CreateComposite/component.tsx)
  and [ManageComposites](packages/creator-hub/renderer/src/components/Modals/ManageComposites/component.tsx).
- Disk ops: [preload/src/modules/composites.ts](packages/creator-hub/preload/src/modules/composites.ts)
  (`listComposites`, `createComposite`, `deleteComposite`, `duplicateComposite`). New
  composites are created under `assets/custom/<folder>/composite.json`.
- Inspector reads the active composite via the `compositePath` config/URL param
  ([config.ts](packages/inspector/src/lib/logic/config.ts)); `getCurrentCompositePath()` /
  `isAltCompositeMode()` in [fs-utils.ts](packages/inspector/src/lib/data-layer/host/fs-utils.ts)
  drive UI adaptations (hide ground/spawn points, allow root rename, relabel root in tree, etc.).
- **Switching composites = re-point the inspector at a different file and reload.** Each is
  edited standalone; there is no live nesting in the UI yet.

### 2.3 The flattening problem
- [add-asset/index.ts](packages/inspector/src/lib/sdk/operations/add-asset/index.ts) instances
  an asset by **expanding all of its entities into the main composite**: it creates new
  entities, deep-copies every component, remaps ids, resolves `{assetPath}` placeholders, and
  remaps trigger/action references. The only back-reference kept is `CustomAsset.assetId` on the
  root entity. The link to the source composite is otherwise lost.
- Consequence today: ✅ you can tell which asset was used; ❌ no overrides vs defaults;
  ❌ editing the source does not update instances; ❌ no "revert to source".

### 2.4 What `dumpEngineToComposite` already does (and doesn't)
[engine-to-composite.ts](packages/inspector/src/lib/data-layer/host/utils/engine-to-composite.ts):
- It **already handles `CompositeRoot`**: child-composite entities are added to `ignoreEntities`
  and only `{ src, entities: [] }` is written for the root — i.e. the child's own entities are
  NOT duplicated into the parent on save. Good foundation.
- ⚠️ **It writes `entities: []` (empty) and has explicit `TODO`s about overrides** — so any
  per-instance override on a child entity is currently dropped on save. Closing this gap is
  central to this feature.

### 2.5 Tree / hierarchy
- Hierarchy is stored in a dedicated `Nodes` component on `ROOT` (not `Transform.parent`):
  [lib/sdk/components/index.ts](packages/inspector/src/lib/sdk/components/index.ts),
  [lib/sdk/nodes.ts](packages/inspector/src/lib/sdk/nodes.ts),
  [lib/sdk/tree.ts](packages/inspector/src/lib/sdk/tree.ts).
- Tree UI: [Tree.tsx](packages/inspector/src/components/Tree/Tree.tsx) +
  [Hierarchy.tsx](packages/inspector/src/components/Hierarchy/Hierarchy.tsx) +
  [useTree.ts](packages/inspector/src/hooks/sdk/useTree.ts).
- Context menus: [Tree/ContextMenu](packages/inspector/src/components/Tree/ContextMenu/ContextMenu.tsx)
  and [Hierarchy/ContextMenu](packages/inspector/src/components/Hierarchy/ContextMenu/ContextMenu.tsx)
  (rename, add child, duplicate, delete, create custom item, add component).

---

## 3. Reference: how Godot does this (UX we borrow)

Godot's instanced-scene workflow is the closest established solution to what we want. The
relevant affordances, and how we map each onto composites/entities (**without renaming our
elements**):

| Godot affordance | What it does in Godot | Our adaptation |
|------------------|-----------------------|----------------|
| **Scene tabs** (top bar) | Each open scene is a tab; you switch scenes by clicking tabs, and history back/forward arrows navigate the stack. | **Decided against tabs for v1.** Navigation is a **breadcrumb** (Scene › House › Table) plus the existing `CompositeSelector` dropdown. Only one composite is open in the inspector at a time; opening a sub-composite switches the active composite. (Tabs remain a possible later addition.) |
| **"Open in Editor"** — a small clapperboard/film-slate icon shown to the right of an instanced node in the Scene dock | One click opens the instanced scene's own file for editing (in its own tab). | A per-row **"open" icon on instance entities** in the entity tree → switches the active composite to that instance's source (House, Table). This is the answer to "open House/Table from the tree". |
| **Instance Child Scene** (chain-link button) | Adds a scene as an instance (single node, not flattened) rather than building nodes by hand. | Adding a composite-backed asset creates a `CompositeRoot` instance, not a flattened copy (§5.1). Instance entities get a distinct icon, like Godot's. |
| **Editable Children** (right-click toggle) | Reveals an instance's internal nodes so you can override them locally; internal nodes render with a distinct (lighter / linked) style and can be overridden but not removed. | We keep the *behavior* but **not the "Editable children" label** — in the UI we speak in terms of the **composite** and its entities. An instance's child entities are editable in place (edits become overrides). Following Godot, you **cannot delete** a child entity, but you **can delete its components** — in practice neutralizing it locally (§6.3, Q7). |
| **Property revert arrow** (Inspector) | An overridden property shows a curved **revert arrow** next to it; clicking resets it to the instance/template default. Non-overridden properties show no arrow. | Same affordance in our EntityInspector: overridden fields show a revert control; click = drop that override (§6.4). This is *the* signal distinguishing "overridden" from "inherited from template". |
| **Make Local** (right-click) | Breaks the link and converts the instance into plain, editable nodes (the old flatten behavior). | Right-click an instance → **"Make local"** = the explicit unpack/flatten escape hatch (replaces today's implicit always-flatten). |
| **Save Branch as Scene** (right-click) | Extracts a subtree into a new scene file and instances it back in place. | Right-click a subtree → **"Save as composite"** — turns e.g. a hand-built House into a reusable composite and replaces it in place with an instance. Complements the existing "Create Custom Item". |
| **File watching / auto-reload** | Editing a source scene updates all its instances automatically. | Editing a template composite propagates to instances on reload/switch (live propagation is a stretch goal — §5.3). |

Key Godot principles worth keeping:
- **Instance by default, flatten only on demand.** You almost always work with a live link;
  "Make Local" is the deliberate exception.
- **Overrides are visible and per-property.** The revert arrow makes it obvious, field by
  field, what deviates from the template — no hidden state.
- **Editing the source is a separate, explicit context.** You leave the parent (open the
  sub-composite in its own tab) to change the template for everyone; you stay in the parent
  (with editable children) to override just this instance. The two are never ambiguous.

Sources: [Godot — editing instanced children / editable children](https://godotforums.org/d/24716-how-to-alter-instanced-scene-s-children),
[Improve Editable Children (godot-proposals #4092)](https://github.com/godotengine/godot-proposals/discussions/4092),
[Make instance local / editable children via tool](https://forum.godotengine.org/t/is-it-possible-to-make-scene-instance-local-or-editable-children-through-tool/10341).

---

## 4. Core concepts / vocabulary (proposed)

We keep our element names (`composite`, `entity`) and borrow Godot's *interaction* names where
they fit. Proposed working vocabulary:

| Term | Meaning |
|------|---------|
| **Template (composite)** | A `.composite` file describing a reusable group of entities (House, Table). The source of truth. |
| **Instance** | A placement of a template inside another composite, represented by a `CompositeRoot` entity pointing at the template `src`. |
| **Child entity** | An entity belonging to an instance's source composite. Editable in place (edits create overrides); its components can be removed, but the entity itself cannot be deleted (Q7). |
| **Override** | A per-instance change to a component value (or a removed component) that differs from the template. Stored as a delta on the instance, not in the template. |
| **Revert** | Removing overrides so the instance matches the template again (whole-instance, per-entity, or per-component). The revert arrow does this per field. |
| **Make local** | Break the instance link and flatten it into plain entities (Godot label kept). |
| **Edit template** | Opening the template composite itself and changing it → propagates to all instances. |

**Decided (§9):** UI keeps Godot's **"Make local"** and **revert** labels. We **avoid the
"Editable children" term** and speak in terms of the **composite** and its entities. Copy
leans toward plain "composite" over "Template".

---

## 5. Target data model

### 5.1 Instancing = `CompositeRoot`, not flattening
When the user adds/instances a composite (House, Table), create **one entity with a
`CompositeRoot` component** referencing the template's `src`, instead of expanding all
entities into the parent. `Composite.instance()` already expands `CompositeRoot` children at
load time, so the entities still appear in the tree — but on disk the parent composite only
stores the reference, and the children live in the template file.

```
House.composite (template)         main.composite (parent)
  entities: Table x2                  CompositeRoot { src: "House.composite", entities: [...] }
```

### 5.2 Overrides — RESOLVED by the Phase 0 spike

> Spike done against `@dcl/ecs@7.15.2` (source: `node_modules/@dcl/ecs/dist/composite/instance.js`,
> `composite/components.js`, `engine/lww-element-set-component-definition.js`) and
> `@dcl/sdk-commands` (`dist/logic/composite.js`). Findings below are verified against code,
> not assumed. Phase 0 summary in §7.

**Verdict: Option A (native layering) is impossible; Option B (sidecar) is required.**

Why A is dead — three independent blockers:
1. **No schema slot.** `CompositeRoot` (`composite::root`) is literally
   `{ src: String, entities: Array<{ src: Entity, dest: Entity }> }`. There is **nowhere** to
   store override values.
2. **`Composite.instance` uses `create()`, not `createOrReplace()`.** It instances children
   *first*, then copies the parent's own components with `componentDefinition.create(targetEntity, …)`,
   which **throws `"[create] Component … already exists"`** if that entity already has the
   component. So you cannot have the parent composite shadow a child's component — it would error,
   not override. There is no merge / last-write-wins step.
3. **It's an unimplemented, deprecated feature.** The instancing code carries a `TODO`:
   *"in the future, the instanciation is first, then the overrides (to parameterize Composite,
   e.g. house with different wall colors)"* — and the whole `Composite` API + `CompositeRoot` are
   tagged `@deprecated: "composite is not being supported so far, please do not use this feature"`.

**Decided mechanism — (B) sidecar override component.** Define an inspector-managed component,
e.g. `CompositeOverrides`, holding `{ childSrcEntity, componentName, op: 'set' | 'remove', value? }[]`.
After `Composite.instance` expands an instance, we apply these deltas onto the resolved engine
entities (`createOrReplace` for `set`, `deleteFrom` for `remove`). Revert = drop a delta. This is
the only option that natively expresses **component removal** (Q7).

Two hard implementation constraints the spike surfaced:

- **Key overrides by template `src` entity-id, not engine entity-id.** With `EMM_DIRECT_MAPPING`
  (what the inspector uses, [composite-provider.ts:128-131](packages/inspector/src/lib/data-layer/host/composite-provider.ts#L128)),
  an instance's **root** entity is deterministic, but its **internal** entities are allocated via
  `engine.addEntity()` at load → their numbers are **not stable across reloads**. So a delta keyed
  by engine (`dest`) entity would break on reload. Key by the template-internal `src` id (stable),
  and resolve `src → dest` after instancing via the `{src,dest}` map that `Composite.instance`
  stamps onto the `CompositeRoot.entities` array.
- **Overrides do NOT survive the standard build by themselves** — see §5.4. This is the big one.

### 5.3 Propagation — confirmed working through the build, for free
- Editing a template file and reloading re-instances it everywhere → instances pick up changes
  automatically **for non-overridden values**. Overridden values stay as the instance's local
  delta. (This is Godot's "edit the source → all instances update" behavior.)
- **Spike confirms this needs zero SDK changes.** Both the editor's loader and the publish build
  (`@dcl/sdk-commands` `getAllComposites`) call `Composite.instance`, which recursively expands
  `CompositeRoot` children. So nesting + "edit template → all instances update" works end-to-end
  today. **This is why nesting/propagation can ship before overrides** (see re-phasing in §7).
- **Decided: propagate on switch.** v1 re-instances templates when you switch the active
  composite. Because we have **no tabs**, you won't see an edited template reflected in its
  instances until you switch the inspector back to the composite that contains them — accepted v1
  limitation, not a bug. Live propagation across an already-open view is a follow-up.

### 5.4 Runtime / build reality — overrides need an editor-side bake
The publish/preview build (`@dcl/sdk-commands` → `getAllComposites`,
`dist/logic/composite.js`) globs `**/*.composite`, instances each into a fresh engine with
`Composite.instance`, and dumps the **flattened** result to `main.crdt` via the inspector's own
`dumpEngineToCrdtCommands`. Consequences:

- ✅ **Nesting reaches the runtime** — children are expanded and baked into `main.crdt`.
- ❌ **Sidecar overrides are invisible to this build.** `getAllComposites` does its *own*
  `Composite.instance` and never runs our override-application step, and `Composite.instance`
  ignores unknown components. So the runtime would get **template defaults, not your overrides**.
- ⚠️ **File-extension gotcha.** The build glob is `**/*.composite`; the dropdown currently creates
  `assets/custom/<name>/composite.json`. A `.json` sub-composite referenced as a `src` won't be
  picked up by the build. Sub-composites that participate in nesting must be `.composite`.

**Therefore overrides require one of:**
- **(I) Editor-side bake (recommended for v1):** on export/publish, the inspector writes the
  buildable composite with instances **flattened and overrides applied** (the editor keeps the
  rich nested+overrides representation for editing; the artifact the build consumes is flat). No
  SDK changes; self-contained.
- **(II) Implement composite overrides in `@dcl/ecs`** (the SDK's own `TODO`): the proper
  long-term fix, but means owning/un-deprecating that primitive and coordinating an SDK release.
- **(III) Defer overrides** entirely and ship nesting + propagation first (§7 Milestone A), which
  needs none of this.

### 5.3 Propagation
- Editing a template file and reloading re-instances it everywhere → instances pick up changes
  automatically **for non-overridden values**. Overridden values stay as the instance's local
  delta. (This is Godot's "edit the source → all instances update" behavior.)
- **Decided: propagate on switch.** v1 re-instances templates when you switch the active
  composite. Because we have **no tabs**, you won't see an edited template reflected in its
  instances until you switch the inspector back to the composite that contains them — that's an
  accepted limitation for v1, not a bug. Live propagation across an already-open view is a
  follow-up.

---

## 6. Feature breakdown & UX

### 6.1 Open a sub-composite from the entity tree
- Borrowing Godot's **"Open in Editor"**: show a small **"open" icon on instance rows** in the
  entity tree, plus a context-menu **"Edit template"** action (and/or double-click).
- This switches the inspector's active composite to that instance's `src` (reuse the existing
  `compositePath` switch path the dropdown already uses).
- **Navigation: breadcrumb + existing dropdown — no tabs (decided).** A breadcrumb
  (Scene › House › Table) shows the path and lets you click back up; the `CompositeSelector`
  dropdown stays as the "open another composite" entry point. Only one composite is open at a
  time. On returning to the parent, re-load so template edits are visible (§5.3).
- Reuse `isAltCompositeMode()` adaptations; extend them to drive the multi-level breadcrumb.

### 6.2 Nesting (House → Table → …)
- Recursive: opening House shows its Tables; each Table is itself an instance you can open.
- Guard against **cyclic references** (A contains B contains A). Detect on add and on open;
  block with a clear error.

### 6.3 Template edit vs instance override — the signal
- **Editing the composite's child entities:** an instance's children are visible and editable
  in place (we use "composite"/"entity" wording, **not** "Editable children"). Editing any
  child value produces a local override on that instance.
- **Deletion rules (Q7, Godot-style):** you **cannot delete** a child entity that comes from
  the template, but you **can delete its components**. Removing all of an entity's meaningful
  components is the way to "make it as if the entity isn't there" for this instance, without
  touching the template or sibling instances. A removed component is itself an override (it must
  persist and be reversible — see §5.2 (B) `op: 'remove'`).
- **Override = revert arrow:** when a component field on an instanced entity differs from the
  template, show the **revert arrow** next to that field in the EntityInspector. Its presence is
  the override signal; its absence means "inherited from template". No separate chip needed,
  though a subtle highlight on the field label can reinforce it.
- Editing a field on an instance creates the override automatically (deliberate, visible via the
  arrow appearing).
- Offer an explicit **"Apply to template"** action to push an instance's value up to the
  template (affecting all instances) vs. leaving it local.

### 6.4 Revert to defaults
- Per-field: click the **revert arrow** → drop that override, field snaps back to the template
  value.
- Per-entity / per-instance: context-menu **"Revert all overrides"** → the instance matches the
  template again.
- Must update the live engine and persist (remove the delta from the chosen override store).

### 6.5 Add / instance / unpack flow (replace implicit flattening)
- New assets dragged in become `CompositeRoot` instances (§5.1) by default — **instance by
  default**, Godot-style.
- **"Make local"** (right-click) is the explicit unpack/flatten action, replacing today's
  always-flatten behavior.
- **"Save as composite"** (Godot's "Save Branch as Scene") turns a hand-built subtree into a
  reusable composite + instance in place. Complements existing "Create Custom Item".
- **Migration: no auto-convert (decided).** Existing flattened scenes stay as-is; the new
  instancing model applies only to newly added items. We do not retroactively turn legacy
  `CustomAsset` copies into `CompositeRoot` instances.

---

## 7. Implementation phases

> **The spike re-shaped the phasing.** Nesting + propagation work through the existing build with
> **zero SDK changes** (§5.3); per-instance overrides need the export-bake decision (§5.4). So the
> work splits into two milestones, and **Milestone A is shippable on its own**.

### Phase 0 — SDK spike ✅ DONE
Findings recorded in §5.2 / §5.3 / §5.4. Headlines:
- `CompositeRoot` = `{ src, entities:[{src,dest}] }` — no override slot.
- `Composite.instance` instances children then `create()`s parent components (throws on dup, no
  merge); overrides are an explicit unimplemented `TODO`; the API is `@deprecated`.
- Nesting + propagation already expand at editor-load **and** publish-build time → ship without SDK
  changes.
- Overrides must use a **sidecar component** keyed by template `src` id, and be **baked on export**
  (§5.4) because `@dcl/sdk-commands` re-instances composites and won't see our deltas.
- Watch-outs: sub-composites must be `.composite` (build glob), not `composite.json`; SDK
  `@deprecated` tag is a strategic risk (§10).

---

### Milestone A — Nesting, sub-composite editing & propagation (no SDK changes)

#### Phase A1 — Instance instead of flatten
- Change [add-asset](packages/inspector/src/lib/sdk/operations/add-asset/index.ts) (and the
  Renderer drop handlers) to create a `CompositeRoot` instance for composite-backed assets.
- Ensure `Composite.instance()` expansion populates the tree correctly (Nodes hierarchy from
  the instanced entities), with a distinct instance icon.
- Ensure [engine-to-composite.ts](packages/inspector/src/lib/data-layer/host/utils/engine-to-composite.ts)
  round-trips instances (it already skips child entities; verify save/reload is stable).
- Make sub-composite files `.composite` so the publish build's `**/*.composite` glob picks them up
  (§5.4 gotcha); align the dropdown's `composite.json` creation accordingly.
- Add **"Make local"** (flatten) as the explicit escape hatch.

#### Phase A2 — Open sub-composite from the tree + breadcrumb
- "Open in Editor" icon + context-menu "Edit template" / double-click on instance entities →
  switch `compositePath`.
- **Breadcrumb** navigation (no tabs); extend `isAltCompositeMode` adaptations to multi-level.
- Back navigation reloads parent so template edits show (propagation on switch, §5.3).
- Cycle guard: SDK throws on recursive `src`; pre-validate in the UI for a friendly message.

#### Phase A3 — Propagation verification
- Confirm template edits show on all instances after switching back (editor) and after publish
  build (runtime). Mostly test/validation, since the mechanism is already there.

---

### Milestone B — Per-instance overrides (gated on §5.4 export-bake decision)

#### Phase B0 — Decide the override→runtime path (§5.4: I / II / III)
**Decision required before B1.** Recommended: **(I) editor-side bake** for v1.

#### Phase B1 — Override store + apply
- Implement the `CompositeOverrides` sidecar (§5.2), keyed by template `src` id, with
  `op: 'set' | 'remove'` (removal satisfies Q7).
- Apply deltas after `Composite.instance`, resolving `src → dest` from `CompositeRoot.entities`.
- Persist via `dumpEngineToComposite` (replace the `entities: []` / `TODO`).
- Child entities editable in place; template-owned entities can't be deleted but their components
  can (§6.3).

#### Phase B2 — Override UI
- EntityInspector: revert-arrow indicators, create-override-on-edit, **"Apply to template"**.

#### Phase B3 — Revert
- Per-field revert (arrow), per-instance "Revert all overrides"; wire into undo/redo + autosave.

#### Phase B4 — Export bake + "Save as composite" + polish
- Implement the chosen export bake (flatten instances + apply overrides into the buildable
  artifact) and verify overrides render in preview/publish.
- "Save as composite" (extract subtree → template + instance).
- Error states, edge cases, i18n strings, e2e tests.

---

## 8. Key files to touch

| Area | File(s) |
|------|---------|
| Instancing (de-flatten) | [add-asset/index.ts](packages/inspector/src/lib/sdk/operations/add-asset/index.ts), [Renderer.tsx](packages/inspector/src/components/Renderer/Renderer.tsx) |
| Save/dump + overrides | [engine-to-composite.ts](packages/inspector/src/lib/data-layer/host/utils/engine-to-composite.ts) |
| Load/instance | [composite-provider.ts](packages/inspector/src/lib/data-layer/host/composite-provider.ts), [fs-composite-provider.ts](packages/inspector/src/lib/data-layer/host/utils/fs-composite-provider.ts) |
| Active-composite switching / breadcrumb | [fs-utils.ts](packages/inspector/src/lib/data-layer/host/fs-utils.ts), [config.ts](packages/inspector/src/lib/logic/config.ts), [useEditor.ts](packages/creator-hub/renderer/src/hooks/useEditor.ts), [CompositeSelector](packages/creator-hub/renderer/src/components/CompositeSelector/component.tsx) |
| Tree + context menu (open icon, make local, save as composite) | [useTree.ts](packages/inspector/src/hooks/sdk/useTree.ts), [Hierarchy.tsx](packages/inspector/src/components/Hierarchy/Hierarchy.tsx), [Hierarchy/ContextMenu](packages/inspector/src/components/Hierarchy/ContextMenu/ContextMenu.tsx), [Tree/ContextMenu](packages/inspector/src/components/Tree/ContextMenu/ContextMenu.tsx) |
| Override UI (revert arrow) | [EntityInspector](packages/inspector/src/components/EntityInspector/EntityInspector.tsx), [EntityHeader.tsx](packages/inspector/src/components/EntityInspector/EntityHeader/EntityHeader.tsx) |
| Disk ops / modals (creator-hub) | [composites.ts](packages/creator-hub/preload/src/modules/composites.ts), [CreateComposite](packages/creator-hub/renderer/src/components/Modals/CreateComposite/component.tsx), [ManageComposites](packages/creator-hub/renderer/src/components/Modals/ManageComposites/component.tsx) |
| Publish/build (reference; export bake — §5.4) | `@dcl/sdk-commands` `dist/logic/composite.js` `getAllComposites` (consumes `**/*.composite`, emits `main.crdt`) |
| i18n | [en.json](packages/creator-hub/renderer/src/modules/store/translation/locales/en.json) |

---

## 9. Open questions / decisions

### Still open
1. **Override → runtime path** *(the one real decision left, gated before Milestone B)* — how
   per-instance overrides reach the published scene, given that `@dcl/sdk-commands` re-instances
   composites and ignores our sidecar deltas (§5.4). Options: **(I) editor-side bake** (recommended
   for v1, no SDK changes), **(II) implement composite overrides in `@dcl/ecs`** (proper, but owns
   a deprecated SDK primitive), **(III) defer overrides** and ship Milestone A only. §5.4, §7 Phase B0
2. **SDK deprecation stance** — `Composite`/`CompositeRoot` are `@deprecated` in `@dcl/ecs`. Confirm
   with the protocol/SDK team that nesting will remain supported (the publish build still uses it)
   before building on it long-term. §10

### Decided (incl. Phase 0 spike outcomes)
- **Override storage mechanism** — **(B) sidecar `CompositeOverrides`**, keyed by template `src`
  id, `op: 'set'|'remove'`. Native layering (A) proven impossible by the spike. §5.2
- **Nesting/propagation need no SDK changes** — expand at editor-load and publish-build. §5.3
3. **Navigation model** — **breadcrumb + existing dropdown, no tabs** for v1. §6.1
3. **Legacy migration** — **no auto-convert**; new model applies to newly added items only. §6.5
4. **Vocabulary in UI** — keep **"Make local"** and **revert**; **avoid "Editable children"**,
   use "composite"/"entity" wording; lean to plain "composite" over "Template". §4
5. **Propagation** — **propagate on switch**; with no tabs, instances reflect template edits
   only after switching the inspector back to the containing composite (accepted v1 limitation). §5.3
6. **Editing scope default** — confirmed: editing an opened Table is a **template** edit
   (affects all instances); overriding stays local on the instance. §6.3
7. **Child-entity rules** — confirmed (Godot-style): **cannot delete** a template-owned child
   entity, but **can delete its components** to neutralize it locally. Removal is a persisted,
   reversible override. §6.3, §5.2(B)

---

## 10. Risks

- **SDK deprecation (highest strategic risk):** `Composite` / `CompositeRoot` carry
  `@deprecated: "composite is not being supported so far, please do not use this feature"` in
  `@dcl/ecs`. The publish build still uses them, but we'd be building on a primitive flagged for
  removal. **Action:** confirm the roadmap with the protocol/SDK team; ideally get composite
  (and its override `TODO`) officially supported — that would also unlock override option (II).
- **Overrides don't survive the standard build (§5.4):** sidecar deltas are invisible to
  `@dcl/sdk-commands`; Milestone B is blocked until the export-bake path (Phase B0) is chosen and
  built. Nesting/propagation (Milestone A) are unaffected.
- **Entity-id instability:** instanced children get `addEntity()` ids that change across loads, so
  overrides must key on template `src` ids and resolve via `CompositeRoot.entities` (§5.2). Getting
  this wrong silently corrupts overrides.
- **Id remapping complexity:** overrides + nesting + triggers/actions that reference entities by id
  is the historically fragile area (see add-asset's existing remapping).
- **Round-trip stability:** save → reload must be idempotent (no entity duplication, stable ids).
- **File-extension mismatch (§5.4):** sub-composites must be `.composite` to be globbed by the
  build; the dropdown currently writes `composite.json`.
- **Performance:** deep nesting re-instanced on every reload/switch.
