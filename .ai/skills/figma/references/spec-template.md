# Spec template

One spec per unit: one Figma component set, or the assembly of a surface against its board ([`design-loop.md`](design-loop.md)). Save it as `docs/specs/<unit>/spec.md`; `docs/specs/` is excluded locally and never committed. Keep every section, in this order, even when one says "none", so two specs can be compared.

```markdown
# <Unit name> spec

unit: <Figma set or surface> · PR: <spoke branch, or "not opened"> · round: <N/3>

## §0 Board read

| Node   | Name   | Kind (set / variant / board) | Variants |
| ------ | ------ | ---------------------------- | -------- |
| `<id>` | <name> | <kind>                       | <count>  |

- Read: <date and time>, <MCP or browser>.
- Diff against the previous read: <"first read", "unchanged", or each added, removed or renamed node id>.
- Standing decisions the board now contradicts (re-confirm with the user): <list, or "none">.

## §1 Mapping

| Figma node | App surface | Code (file, selector) | Renderer |
| --- | --- | --- | --- |
| `<id>` <variant> | <panel / screen> | `<path>` `<selector>` (queried in the running DOM) | Babylon / Bevy / Creator Hub |

## §2 Values

One row per variant × state: default, hover, press, active or selected, focus, disabled. A state Figma doesn't draw is a ✱ row with Figma's nearest drawn value.

| Variant | State | Fill | Border (width, colour) | Radius | Typography | Shadow | Spacing | Size | Source |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| <variant> | default | <value> | <value> | <px> | <family size / weight / line-height, colour> | <value or none> | <padding / gap> | <w × h> | panel read / canvas (±2px) / ✱ |

## §3 Tokens per world

| Literal | Inspector token (`vars.css`) | Creator Hub token (ui2 / `theme.css`) | `DESIGN.md` row | Status |
| --- | --- | --- | --- | --- |
| `<hex / px>` | `--<token>` | `<ui2 path or --token>` | <section → row> | match / new / ships in #<PR> / ✱ |

## §4 Reuse

- Existing control: <path under `src/components/`, `ui/` first, or a ui2 component>.
- New CSS: <"zero new CSS", or each rule and why no existing rule covers it>.

## §5 API

`<Component variant="…" size="…" color="…" />`: variants, sizes and states as union props, never boolean modes.

## §6 Accessibility

| Pair or control | Foreground | Background (real surface) | Ratio | Minimum | Pass |
| --- | --- | --- | --- | --- | --- |
| <label / glyph / ring / border> | `<hex>` | `<hex>` | <n.nn:1> | 4.5 text / 3 non-text | yes / no / ✱ |

- Focus ring: `<token>`, <width and offset>.
- Accessible names: <control → name>.
- Hit targets: <control → size, ≥ 24px or ✱>.

## §7 Strings

| String   | Where     | New / recased / existing |
| -------- | --------- | ------------------------ |
| "<text>" | <control> | <kind>                   |

## §8 Screenshot checklist

| # | State | Renderer | Fixture | Figma variant |
| --- | --- | --- | --- | --- |
| 1 | <state> | standalone inspector (Babylon) / Creator Hub (Bevy) | <fixture, and the reset step before the shot> | `<id>` |
```
