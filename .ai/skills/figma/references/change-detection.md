# Figma change detection

How to tell which parts of the Design System file changed since `docs/DESIGN.md` mapped them, so a Figma read only happens where something is new. It works without a Figma REST token, so there is no `lastModified` or per-component `updated_at`; the MCP budget is 20 calls a month; and the version-history panel opens for a View seat but has not been seen to load its entries, so there is no file-level gate.

## Three levels

Run them in order and stop at the first level that reports nothing new for the scope you care about.

| Level | Detects | Source | Cost |
| --- | --- | --- | --- |
| 1. Pages | New, removed, moved and renamed pages; a page newly marked `🟡 Outdated` | Figma's page list from the web client's store, diffed by node id against `docs/DESIGN.md` → "Pages inventory" | Free: one browser read |
| 2. Component sets | Added, removed or renamed sets and variants on a page | The Layers panel tree (set names, variant names, counts, node ids), diffed against the `### <Set> (<page>)` header lines in `docs/DESIGN.md` | Free: browser reads, a few minutes per page |
| 3. Values | A colour, radius, size or type change inside an unchanged structure | Re-reading the set (MCP `get_design_context`, or the Properties panel) | One MCP call per set, or minutes per variant in the browser |

Level 3 is never free. Two things limit how often it's needed:

- **Sets in the unit in progress** are re-read anyway: Validate compares the running code against the live Figma frames ([`design-loop.md`](design-loop.md)), so value drift there is caught during the unit.
- **Sets outside the unit in progress** are the only blind spot. Cover them with a periodic re-read, budget permitting, or with a design-side convention (below).

### Level 1: the page diff

In Chrome on the file, run in the page context:

```js
(store.getState().mirror.appModel.pagesList || []).map(
  (p, i) => `${i}|${p.nodeId || p.id}|${(p.name || '').trim()}`,
);
```

Diff the ids against the inventory's ids. A new id is a new page; a missing id is a removed page; the same id at a different position is a moved page; the same id with a different name is a rename. Ids are stable, so a move is never mistaken for a new page.

### Level 2: the set diff

Every set block in `docs/DESIGN.md` opens with a header line that carries the set's node id, its variant count and each variant's name and node id, so the doc itself is the baseline:

```sh
rg -n -A2 '^### .+ \(<Page name>\)$' docs/DESIGN.md
```

For each page in scope, harvest the Layers tree as the extraction does ([`browser-extraction.md`](browser-extraction.md): `[data-testid="<id>-layers-panel-row"]` rows, harvested while wheel-scrolling, because the list is virtualised). Record each set's node id, name and sorted variant names, and compare them with the header lines. A set whose id, name, variant count or variant ids differ is marked for a level-3 re-read; a set Figma has and the doc doesn't is new and gets a Match pass. Record the read time and the diff in the spec's §0 ([`spec-template.md`](spec-template.md)).

## A design-side convention (a proposal for the design team)

The page list already carries status in names (`🟡 Outdated`). A matching marker for "a shipped component changed" would close the level-3 blind spot for free: for example, a page-name or frame-name prefix the designer adds when editing a shipped component, which the code side removes once the change ships. That is the design team's call; propose it, don't assume it.

## Upgrade path

With a read-only Figma REST token in the environment, level 1 becomes one call (`GET /v1/files/:key?depth=1` → `lastModified`, `version`). If the file is published as a team library, `GET /v1/files/:key/component_sets` gives every set's `updated_at`, which replaces levels 2 and 3 with one or two calls. Check the REST API's rate limits for the seat before relying on it.
