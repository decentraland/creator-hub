import { describe, expect, it } from 'vitest';

import { isLayerableComponent, UI_BUTTON } from '../../code/parse-adapter';
import type { UINodeType } from '../../shared/tree-model';
import {
  buildGroups,
  buildLayoutGroup,
  POSITION_MODE_FIELD,
  type FieldConfig,
} from './field-configs';

const ALL_TYPES: UINodeType[] = ['UiEntity', 'Label', 'Button', 'Input', 'Dropdown'];

const titles = (type: UINodeType) => buildGroups(type).map(g => g.title);

function fieldsIn(type: UINodeType, groupTitle: string): FieldConfig[] {
  return buildGroups(type).find(g => g.title === groupTitle)?.fields ?? [];
}

function labelsIn(type: UINodeType, groupTitle: string): (string | undefined)[] {
  return fieldsIn(type, groupTitle).map(f => f.label);
}

const allLabels = (type: UINodeType) => buildGroups(type).flatMap(g => labelsIn(type, g.title));

// Props that arrange MY CHILDREN — only a UiEntity has children.
const CONTAINER_ONLY = [
  'Flow',
  'Alignment',
  'Flex Direction',
  'Flex Wrap',
  'Justify Content',
  'Align Items',
  'Align Content',
  'Scroll Overflow',
  'Clip Content',
];

// Props describing how I size and behave inside MY PARENT. Every react-ecs
// element accepts the full uiTransform, so every node type must offer these.
const ITEM_PROPS = [
  'Display',
  'Size',
  'Min Size',
  'Max Size',
  'Align Self',
  'Flex Grow',
  'Flex Shrink',
];

// The single-prop rows a composite control (Flow, Alignment) also writes. Each
// must stay out of the panel while its composite represents the value, so no
// value is ever driven by two live controls at once.
const RAW_ROWS = ['Flex Direction', 'Flex Wrap', 'Justify Content', 'Align Items'];

// Which Layout rows a given UiTransform actually renders. `hiddenWhen` is the row
// gate; the togglable/`+ Add property` split is a separate concern (see
// PropertyPanel `isTogglable`), so this asserts row visibility only.
function visibleRawRows(transform: Record<string, unknown>): string[] {
  return fieldsIn('UiEntity', 'Layout')
    .filter(f => RAW_ROWS.includes(f.label as string) && !f.hiddenWhen?.(transform))
    .map(f => f.label as string);
}

// YGJustify / YGAlign / YGWrap / YGPositionType values used by the row-gate cases.
const JUSTIFY_START = 0;
const JUSTIFY_SPACE_BETWEEN = 3;
const ALIGN_START = 1;
const ALIGN_STRETCH = 4;
const WRAP_NO = 0;
const WRAP_YES = 1;
const WRAP_REVERSE = 2;
const ABSOLUTE = 1;

describe('buildGroups', () => {
  describe('when composing the panel for each node type', () => {
    it('should always lead with Position then Layout', () => {
      for (const type of ALL_TYPES) {
        expect(titles(type).slice(0, 2)).toEqual(['Position', 'Layout']);
      }
    });

    it('should render event groups last', () => {
      for (const type of ALL_TYPES) {
        const t = titles(type);
        const firstEvent = t.findIndex(x => /event/i.test(x));
        expect(firstEvent).toBeGreaterThan(-1);
        // Everything from the first event group onward is an event group.
        expect(t.slice(firstEvent).every(x => /event/i.test(x))).toBe(true);
      }
    });

    it('should put a type’s own content group before Style', () => {
      for (const type of ['Label', 'Button', 'Input', 'Dropdown'] as UINodeType[]) {
        const t = titles(type);
        expect(t.indexOf('Style')).toBeGreaterThan(2);
        // The content group sits at index 2, directly after Position + Layout.
        expect(t[2]).not.toBe('Style');
      }
    });

    it('should compose the exact group order per type', () => {
      expect(titles('UiEntity')).toEqual(['Position', 'Layout', 'Style', 'Mouse Events']);
      expect(titles('Label')).toEqual(['Position', 'Layout', 'Text', 'Style', 'Mouse Events']);
      expect(titles('Button')).toEqual([
        'Position',
        'Layout',
        'Button',
        'Text',
        'Style',
        'Mouse Events',
      ]);
      expect(titles('Input')).toEqual([
        'Position',
        'Layout',
        'Input',
        'Style',
        'Input Events',
        'Mouse Events',
      ]);
      expect(titles('Dropdown')).toEqual([
        'Position',
        'Layout',
        'Dropdown',
        'Style',
        'Dropdown Events',
        'Mouse Events',
      ]);
    });

    // The former Effects group held only opacity + z-index and Border only three
    // fields; both were junk drawers, now folded into Position and Style.
    it('should no longer expose Effects, Border or Background groups', () => {
      for (const type of ALL_TYPES) {
        expect(titles(type)).not.toContain('Effects');
        expect(titles(type)).not.toContain('Border');
        expect(titles(type)).not.toContain('Background');
      }
    });

    // Guards the `/event/i` title match that decides render order: a content
    // group whose title happened to contain "event" would jump to the end.
    it('should not name a content group anything matching /event/i', () => {
      for (const type of ALL_TYPES) {
        const contentTitles = titles(type).filter(
          t => !['Mouse Events', 'Input Events', 'Dropdown Events'].includes(t),
        );
        expect(contentTitles.filter(t => /event/i.test(t))).toEqual([]);
      }
    });
  });

  describe('and the layout fields are split by whose layout they affect', () => {
    // Regression: flexGrow/flexShrink are ITEM props (how I behave in my parent)
    // but were gated as container props, so a Label or Button inside a flex row
    // could not be told to grow or shrink. `alignSelf`, their sibling, was not
    // gated — which is what made the split visibly inconsistent.
    it('should offer every item prop to every node type', () => {
      for (const type of ALL_TYPES) {
        for (const label of ITEM_PROPS) {
          expect(labelsIn(type, 'Layout')).toContain(label);
        }
      }
    });

    it('should offer container props only to UiEntity', () => {
      for (const label of CONTAINER_ONLY) {
        expect(labelsIn('UiEntity', 'Layout')).toContain(label);
      }
      for (const type of ['Label', 'Button', 'Input', 'Dropdown'] as UINodeType[]) {
        for (const label of CONTAINER_ONLY) {
          expect(labelsIn(type, 'Layout')).not.toContain(label);
        }
      }
    });

    // The design leads Layout with the composite controls, then the single-prop
    // fields they decompose into. Those trailing rows are the escape hatches for
    // what a composite cannot express, so they must stay present AND non-core
    // (hidden until authored) — a core duplicate would show two controls for the
    // same prop on every fresh node.
    it('should lead Layout with the composite controls, in the design’s order', () => {
      expect(labelsIn('UiEntity', 'Layout').slice(0, 7)).toEqual([
        'Flow',
        'Size',
        'Min Size',
        'Max Size',
        'Alignment',
        'Padding',
        'Margin',
      ]);
    });

    it('should keep the props a composite control writes reachable as their own rows', () => {
      const layout = fieldsIn('UiEntity', 'Layout');
      for (const label of RAW_ROWS) {
        const field = layout.find(f => f.label === label);
        expect(field, `${label} is missing`).toBeDefined();
        expect(field?.core, `${label} must stay hidden until authored`).toBeUndefined();
      }
    });

    // Hug (Yoga's `auto`) moved from a unit option into the Resize control's
    // per-axis mode selector, so the Size row is the only place it can appear:
    // every other length field renders the plain px/% unit dropdown.
    it('should make Size the per-axis resize control', () => {
      const size = fieldsIn('UiEntity', 'Layout').find(f => f.label === 'Size');
      expect(size?.kind).toBe('resize');
      const otherKinds = buildLayoutGroup(true)
        .fields.filter(f => f.label !== 'Size')
        .map(f => f.kind);
      expect(otherKinds).not.toContain('resize');
    });

    it('should not reserve the name "Spacing" for the padding/margin control', () => {
      // "Spacing" is the design's flex-gap row. The SDK ships gap support
      // (js-sdk-toolchain#1528 preview) but the EXPLORER's renderer does not
      // consume the new proto fields yet — verified in-world 2026-08-06 — so the
      // row was removed rather than shipped as a canvas-only illusion. The full
      // implementation is archived (gap-feature-full-batch.patch, job tmp);
      // re-adding it is a revert once an explorer build renders gap.
      expect(labelsIn('UiEntity', 'Layout')).toContain('Padding');
      expect(labelsIn('UiEntity', 'Layout')).toContain('Margin');
      expect(labelsIn('UiEntity', 'Layout')).not.toContain('Spacing');
    });

    it('should keep the container fields in the same relative order for both variants', () => {
      const withContainer = buildLayoutGroup(true).fields.map(f => f.label);
      const itemOnly = buildLayoutGroup(false).fields.map(f => f.label);
      expect(withContainer.filter(l => !CONTAINER_ONLY.includes(l as string))).toEqual(itemOnly);
    });
  });

  describe('and a field must stay reachable', () => {
    it('should always offer Fill on a UiEntity, since setting its texture is what makes an Image', () => {
      expect(labelsIn('UiEntity', 'Style')).toContain('Fill');
    });

    // UiLabelProps.value is REQUIRED by the SDK. `core` fields get no remove
    // button (PropertyPanel isTogglable requires !core), so this is what stops
    // the panel offering to unset a prop the scene cannot compile without.
    it('should keep a Label/Button text value core and therefore un-removable', () => {
      for (const type of ['Label', 'Button'] as UINodeType[]) {
        const value = fieldsIn(type, 'Text').find(f => f.label === 'Text Input');
        expect(value?.core).toBe(true);
      }
    });

    it('should move Z-Index into Position and Transparency into Style', () => {
      expect(labelsIn('UiEntity', 'Position')).toContain('Z-Index');
      expect(labelsIn('UiEntity', 'Style')).toContain('Transparency');
    });

    it('should gate Anchor and Position on Absolute positioning', () => {
      const gated = fieldsIn('UiEntity', 'Position').filter(f =>
        ['Constraints', 'Position'].includes(f.label as string),
      );
      expect(gated).toHaveLength(2);
      for (const f of gated) {
        expect(f.disabledWhen?.({ positionType: 0 })).toBe(true);
        expect(f.disabledWhen?.({ positionType: 1 })).toBe(false);
        // Unset positionType defaults to in-flow, so it must also be disabled.
        expect(f.disabledWhen?.({})).toBe(true);
      }
    });

    // Position shows two cells, not four. Which two is not fixed: they follow the
    // pin the Anchor row reports, so a bottom-right-anchored node edits the edges
    // Yoga is actually resolving against instead of an unset left/top pair.
    describe('and Position projects its four edges onto X/Y', () => {
      const facadeOf = (v: Record<string, unknown>) =>
        fieldsIn('UiEntity', 'Position').find(f => f.label === 'Position')!.facadeSubFields!(v).map(
          s => `${s.leftLabel}:${s.path}`,
        );

      const pinned = (edges: Record<string, unknown>) => ({ positionType: 1, ...edges });

      it('should show the leading edges for a node anchored top-left', () => {
        expect(facadeOf(pinned({ positionLeftUnit: 1, positionTopUnit: 1 }))).toEqual([
          'X:positionLeft',
          'Y:positionTop',
        ]);
      });

      it('should show the trailing edges for a node anchored bottom-right', () => {
        expect(facadeOf(pinned({ positionRightUnit: 1, positionBottomUnit: 1 }))).toEqual([
          'X:positionRight',
          'Y:positionBottom',
        ]);
      });

      it('should mix the axes independently', () => {
        expect(facadeOf(pinned({ positionRightUnit: 1, positionTopUnit: 1 }))).toEqual([
          'X:positionRight',
          'Y:positionTop',
        ]);
      });

      // A centred pin holds its value on the LEADING edge (50% plus a
      // counter-margin), so that is the cell to expose.
      it('should show the leading edge for a centred pin', () => {
        expect(
          facadeOf(
            pinned({ positionLeftUnit: 2, positionLeft: 50, marginLeftUnit: 1, marginLeft: -20 }),
          ),
        ).toEqual(['X:positionLeft', 'Y:positionTop']);
      });

      it('should fall back to the leading edges for an unpinned node', () => {
        expect(facadeOf({})).toEqual(['X:positionLeft', 'Y:positionTop']);
      });
    });

    // Drawn as a standalone checkbox above every group, and deliberately the SAME
    // `positionType` the Layout group's Flow selector writes — the two mirror each
    // other, so neither may drift onto a different path.
    it('should drive positionType from a standalone checkbox, not a Position row', () => {
      expect(POSITION_MODE_FIELD.label).toBe('Ignore Layout Flow');
      expect(POSITION_MODE_FIELD.kind).toBe('position-mode');
      expect(POSITION_MODE_FIELD.path).toBe('positionType');
      expect(POSITION_MODE_FIELD.core).toBe(true);

      const flow = fieldsIn('UiEntity', 'Layout').find(f => f.label === 'Flow');
      expect(flow?.kind).toBe('flow');
      expect(flow?.componentId).toBe(POSITION_MODE_FIELD.componentId);
    });

    // It gates fields in TWO groups (Position's Anchor/Position, Layout's margin),
    // so it belongs to neither — the panel renders it above them all.
    it('should keep the positionType checkbox out of every group', () => {
      for (const type of ALL_TYPES) {
        expect(allLabels(type)).not.toContain(POSITION_MODE_FIELD.label);
      }
      expect(fieldsIn('UiEntity', 'Position')[0]?.label).toBe('Constraints');
    });

    // The header's eye writes `display`, and being binary it can express BOTH of
    // that prop's values — so a row for it would only ever duplicate the eye. `core`
    // is what keeps it out of `+ Add property` (PropertyPanel `isTogglable`), and
    // `hiddenWhen` is what still shows it for source that already authors it.
    it('should leave Display to the header eye unless source authors it', () => {
      const display = fieldsIn('UiEntity', 'Layout').find(f => f.label === 'Display');
      expect(display?.core).toBe(true);
      expect(display?.hiddenWhen?.({})).toBe(true);
      expect(display?.hiddenWhen?.({ display: 0 })).toBe(false);
      expect(display?.hiddenWhen?.({ display: 1 })).toBe(false);
    });
  });

  // One rule, not four exceptions: a single-prop row surfaces only in the states
  // its composite control cannot represent. Otherwise editing Alignment would
  // silently move the Justify content row two lines below it, and vice versa.
  describe('and a composite control already represents a value', () => {
    const inCell = {
      justifyContent: JUSTIFY_START,
      alignItems: ALIGN_START,
    };

    it('should show no raw rows for an in-flow container whose alignment is in-cell', () => {
      expect(visibleRawRows(inCell)).toEqual([]);
    });

    it('should show no raw rows for a fresh container', () => {
      // Nothing authored: Flow reads `row`, Alignment reads Default. Both faithful.
      expect(visibleRawRows({})).toEqual([]);
    });

    it('should reveal Flex direction only while the node ignores layout flow', () => {
      expect(visibleRawRows({ ...inCell, positionType: ABSOLUTE })).toEqual(['Flex Direction']);
      // …and the direction it is hiding survives in source either way.
      expect(visibleRawRows({ ...inCell, flexDirection: 1 })).toEqual([]);
    });

    it('should reveal both alignment rows for a distributing justifyContent', () => {
      expect(
        visibleRawRows({ justifyContent: JUSTIFY_SPACE_BETWEEN, alignItems: ALIGN_START }),
      ).toEqual(['Justify Content', 'Align Items']);
    });

    it('should reveal both alignment rows for a stretch alignItems', () => {
      expect(visibleRawRows({ justifyContent: JUSTIFY_START, alignItems: ALIGN_STRETCH })).toEqual([
        'Justify Content',
        'Align Items',
      ]);
    });

    // The asymmetric state is what makes the values above reachable: adding
    // `Justify content` from `+ Add property` seeds it while alignItems is still
    // unset, which has no cell — so the row appears and can then be set to
    // Space between.
    it('should reveal both alignment rows when only one of the pair is authored', () => {
      expect(visibleRawRows({ justifyContent: JUSTIFY_START })).toEqual([
        'Justify Content',
        'Align Items',
      ]);
    });

    it('should reveal Flex wrap only for wrap-reverse', () => {
      for (const flexWrap of [WRAP_NO, WRAP_YES]) {
        expect(visibleRawRows({ ...inCell, flexWrap })).toEqual([]);
      }
      expect(visibleRawRows({ ...inCell, flexWrap: WRAP_REVERSE })).toEqual(['Flex Wrap']);
    });

    // Adding it has to leave a VISIBLE row. Seeded at nowrap the row would hide
    // again instantly and the menu entry would read as a no-op while still writing
    // `flexWrap: 0` to source, so the seed is the one value Flow cannot express.
    it('should seed Flex wrap at the value that keeps its row on screen', () => {
      const flexWrap = fieldsIn('UiEntity', 'Layout').find(f => f.label === 'Flex Wrap');
      expect(flexWrap?.defaultValue).toBe(WRAP_REVERSE);
      expect(visibleRawRows({ ...inCell, flexWrap: flexWrap?.defaultValue })).toEqual([
        'Flex Wrap',
      ]);
    });

    it('should resolve the alignment cell against the flex direction, not a fixed axis', () => {
      // flex-end × flex-start is top-right in a row and bottom-left in a column —
      // both in-cell, so neither shows a raw row.
      const pair = { justifyContent: 2, alignItems: ALIGN_START };
      expect(visibleRawRows({ ...pair, flexDirection: 0 })).toEqual([]);
      expect(visibleRawRows({ ...pair, flexDirection: 1 })).toEqual([]);
    });
  });

  // A UI root's parent is the screen, so the three fields describing how a node
  // sits in its parent have nothing to describe there. `hiddenWhen` only sees the
  // component value, never node identity, so this is a separate flag the panel
  // resolves (see PropertyPanel) — these assertions pin which fields carry it.
  describe('and the selected node is a UI root', () => {
    it('should mark exactly the parent-relationship fields', () => {
      const hidden = fieldsIn('UiEntity', 'Position')
        .filter(f => f.hideOnRoot)
        .map(f => f.label);
      expect(hidden).toEqual(['Constraints', 'Position']);
      // The third one lives outside the groups but is gated identically.
      expect(POSITION_MODE_FIELD.hideOnRoot).toBe(true);
    });

    it('should keep Z-Index on a root, where stacking between roots is still real', () => {
      const zIndex = fieldsIn('UiEntity', 'Position').find(f => f.label === 'Z-Index');
      expect(zIndex?.hideOnRoot).toBeUndefined();
    });

    it('should not mark anything outside the Position group', () => {
      for (const type of ALL_TYPES) {
        const marked = buildGroups(type)
          .filter(g => g.title !== 'Position')
          .flatMap(g => g.fields)
          .filter(f => f.hideOnRoot);
        expect(marked).toEqual([]);
      }
    });
  });

  describe('and the node is a Dropdown', () => {
    const emptyLabel = () => fieldsIn('Dropdown', 'Dropdown').find(f => f.label === 'Empty Label');

    it('should show Empty Label only while the dropdown accepts an empty selection', () => {
      expect(emptyLabel()?.hiddenWhen?.({ acceptEmpty: true })).toBe(false);
      expect(emptyLabel()?.hiddenWhen?.({ acceptEmpty: false })).toBe(true);
    });

    it('should hide Empty Label when acceptEmpty is unauthored, its non-optional false', () => {
      expect(emptyLabel()?.hiddenWhen?.({})).toBe(true);
    });
  });

  describe('and a row is paired into two columns', () => {
    // The border row is deliberately NOT paired: a colour control is swatch + hex
    // + alpha, and a ~140px half-track leaves the hex input around 44px.
    it('should mark exactly the fields the design pairs', () => {
      const TEXT_PAIR = ['Typography', 'Size'];
      const STYLE_PAIR = ['Transparency', 'Corner Radius'];
      const expected: Record<string, string[]> = {
        UiEntity: STYLE_PAIR,
        Label: [...TEXT_PAIR, ...STYLE_PAIR],
        Button: [...TEXT_PAIR, ...STYLE_PAIR],
        Input: [...TEXT_PAIR, ...STYLE_PAIR],
        Dropdown: [...TEXT_PAIR, ...STYLE_PAIR],
      };
      for (const type of ALL_TYPES) {
        const half = buildGroups(type)
          .flatMap(g => g.fields)
          .filter(f => f.half)
          .map(f => f.label);
        expect(half, type).toEqual(expected[type]);
      }
    });

    // A half row only earns its column when something can sit beside it, so every
    // marked field must have another half row in the SAME group.
    it('should never leave a half row without a partner in its group', () => {
      for (const type of ALL_TYPES) {
        for (const group of buildGroups(type)) {
          const half = group.fields.filter(f => f.half);
          expect(half.length === 0 || half.length % 2 === 0, `${type} → ${group.title}`).toBe(true);
        }
      }
    });
  });

  describe('and Transparency displays the inverse of the stored opacity', () => {
    const transparency = () => fieldsIn('UiEntity', 'Style').find(f => f.label === 'Transparency');

    // The pair must be exact inverses or a value would drift on every focus/blur
    // cycle that rewrites what it reads. Fractional percents included: the display
    // keeps two decimals, so the opacity side has to keep four to match.
    it('should round-trip the extremes and a mid value exactly', () => {
      const f = transparency();
      for (const display of [0, 33, 33.5, 50, 66.67, 100]) {
        expect(f?.toDisplay?.(f.fromDisplay!(display)), String(display)).toBe(display);
      }
      for (const opacity of [0, 0.25, 0.665, 1]) {
        expect(f?.fromDisplay?.(f.toDisplay!(opacity)), String(opacity)).toBe(opacity);
      }
    });

    it('should read unset opacity as fully opaque, i.e. 0% transparent', () => {
      const f = transparency();
      expect(f?.toDisplay?.(f?.defaultValue as number)).toBe(0);
    });
  });

  describe('and overflow renders as the two derived checkboxes', () => {
    it('should draw both boxes on every container, always, over the one enum prop', () => {
      const layout = fieldsIn('UiEntity', 'Layout');
      const scroll = layout.find(f => f.label === 'Scroll Overflow');
      const clip = layout.find(f => f.label === 'Clip Content');
      expect(scroll?.kind).toBe('overflow-scroll');
      expect(clip?.kind).toBe('overflow-clip');
      for (const f of [scroll, clip]) {
        expect(f?.core).toBe(true);
        expect(f?.path).toBe('overflow');
      }
    });

    // The pair is total over the enum's three values (overflow-flags.spec), so
    // no raw enum row survives as an escape hatch.
    it('should not keep a raw Overflow enum row', () => {
      for (const type of ALL_TYPES) {
        expect(allLabels(type)).not.toContain('Overflow');
      }
    });
  });

  describe('and the node is a Button', () => {
    // Variant was deliberately REMOVED from the panel (user decision 2026-08-06):
    // the canvas cannot render its effect yet (task #30), so the row read as a
    // no-op. The parser still round-trips a hand-authored variant untouched
    // (button-props.spec) — restoring the row is a config push once #30 lands.
    it('should expose exactly Disabled as its own prop, with no Variant row', () => {
      expect(labelsIn('Button', 'Button')).toEqual(['Disabled']);
      for (const f of fieldsIn('Button', 'Button')) expect(f.componentId).toBe(UI_BUTTON);
      const disabled = fieldsIn('Button', 'Button')[0];
      expect(disabled.core).toBe(true);
    });

    // Both props must keep writing a plain JSX attribute whatever interaction state
    // the panel is editing — this is what routes them past setInteractionField.
    it('should keep its own props out of the interaction layers', () => {
      for (const f of fieldsIn('Button', 'Button')) {
        expect(isLayerableComponent(f.componentId)).toBe(false);
      }
      for (const group of ['Text', 'Style']) {
        for (const f of fieldsIn('Button', group)) {
          expect(isLayerableComponent(f.componentId)).toBe(true);
        }
      }
    });
  });

  describe('and every field is well-formed', () => {
    it('should give each field a componentId and a unique label within its group', () => {
      for (const type of ALL_TYPES) {
        for (const group of buildGroups(type)) {
          const labels = group.fields.map(f => f.label);
          expect(new Set(labels).size, `${type}/${group.title} has duplicate labels`).toBe(
            labels.length,
          );
          for (const f of group.fields) expect(f.componentId).toBeTruthy();
        }
      }
    });

    it('should never drive one prop from two rows, even where two groups share a label', () => {
      const identity = (f: FieldConfig) =>
        [
          f.componentId,
          (f.writeAll ?? f.subFields?.map(s => s.path) ?? [f.path]).join(','),
          f.kind,
          f.box ?? '',
        ].join(':');
      for (const type of ALL_TYPES) {
        const seen = buildGroups(type).flatMap(g => (g.fields as FieldConfig[]).map(identity));
        expect(new Set(seen).size, `${type} exposes a field twice`).toBe(seen.length);
      }
    });

    // The design puts an ⓘ on every label, so a missing `info` is visible as a
    // gap in the row rather than merely absent help.
    it('should give every field an info tooltip', () => {
      for (const type of ALL_TYPES) {
        for (const group of buildGroups(type)) {
          for (const f of group.fields) {
            expect(f.info?.trim(), `${type}/${group.title}/${f.label} has no info`).toBeTruthy();
          }
        }
      }
      expect(POSITION_MODE_FIELD.info?.trim()).toBeTruthy();
    });
  });
});
