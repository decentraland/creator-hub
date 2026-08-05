import { describe, expect, it } from 'vitest';

import { buildGroups, buildLayoutGroup, type FieldConfig } from './field-configs';
import type { UINodeType } from './tree-model';

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
  'Flex direction',
  'Flex wrap',
  'Justify content',
  'Align items',
  'Align content',
  'Overflow',
];

// Props describing how I size and behave inside MY PARENT. Every react-ecs
// element accepts the full uiTransform, so every node type must offer these.
const ITEM_PROPS = [
  'Display',
  'Size',
  'Min size',
  'Max size',
  'Align self',
  'Flex grow',
  'Flex shrink',
];

// The single-prop rows a composite control (Flow, Alignment) also writes. Each
// must stay out of the panel while its composite represents the value, so no
// value is ever driven by two live controls at once.
const RAW_ROWS = ['Flex direction', 'Flex wrap', 'Justify content', 'Align items'];

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
      expect(titles('UiEntity')).toEqual(['Position', 'Layout', 'Style', 'Mouse events']);
      expect(titles('Label')).toEqual(['Position', 'Layout', 'Text', 'Style', 'Mouse events']);
      expect(titles('Button')).toEqual(['Position', 'Layout', 'Text', 'Style', 'Mouse events']);
      expect(titles('Input')).toEqual([
        'Position',
        'Layout',
        'Input',
        'Style',
        'Input events',
        'Mouse events',
      ]);
      expect(titles('Dropdown')).toEqual([
        'Position',
        'Layout',
        'Dropdown',
        'Style',
        'Dropdown events',
        'Mouse events',
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
          t => !['Mouse events', 'Input events', 'Dropdown events'].includes(t),
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
      expect(labelsIn('UiEntity', 'Layout').slice(0, 6)).toEqual([
        'Flow',
        'Size',
        'Min size',
        'Max size',
        'Alignment',
        'Padding & margin',
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

    it('should offer `auto` only on the Size vec', () => {
      const withAuto = buildLayoutGroup(true)
        .fields.filter(f => f.autoUnit)
        .map(f => f.label);
      expect(withAuto).toEqual(['Size']);
    });

    it('should not offer `auto` on the length fields where it has no meaning', () => {
      for (const label of ['Corner radius', 'Border width']) {
        expect(
          fieldsIn('UiEntity', 'Style').find(f => f.label === label)?.autoUnit,
        ).toBeUndefined();
      }
    });

    it('should not reserve the name "Spacing" for the padding/margin control', () => {
      // "Spacing" means flex gap in the design, which react-ecs cannot express
      // (no gap/rowGap/columnGap). Keeping the name free avoids a collision.
      expect(labelsIn('UiEntity', 'Layout')).toContain('Padding & margin');
      expect(labelsIn('UiEntity', 'Layout')).not.toContain('Spacing');
    });

    it('should keep the container fields in the same relative order for both variants', () => {
      const withContainer = buildLayoutGroup(true).fields.map(f => f.label);
      const itemOnly = buildLayoutGroup(false).fields.map(f => f.label);
      expect(withContainer.filter(l => !CONTAINER_ONLY.includes(l as string))).toEqual(itemOnly);
    });
  });

  describe('and a field must stay reachable', () => {
    // Image is DERIVED from having a background texture (tree-model.classifyNode),
    // so Texture is the only way to turn a Container into an Image. Hiding it on a
    // container would make an Image uncreatable.
    it('should offer Texture on a UiEntity regardless of whether one is set', () => {
      expect(labelsIn('UiEntity', 'Style')).toContain('Texture');
    });

    // UiLabelProps.value is REQUIRED by the SDK. `core` fields get no remove
    // button (PropertyPanel isTogglable requires !core), so this is what stops
    // the panel offering to unset a prop the scene cannot compile without.
    it('should keep a Label/Button text value core and therefore un-removable', () => {
      for (const type of ['Label', 'Button'] as UINodeType[]) {
        const value = fieldsIn(type, 'Text').find(f => f.label === 'Value');
        expect(value?.core).toBe(true);
      }
    });

    it('should move Z-index into Position and Opacity into Style', () => {
      expect(labelsIn('UiEntity', 'Position')).toContain('Z-index');
      expect(labelsIn('UiEntity', 'Style')).toContain('Opacity');
    });

    it('should gate Anchor and Position on Absolute positioning', () => {
      const gated = fieldsIn('UiEntity', 'Position').filter(f =>
        ['Anchor', 'Position'].includes(f.label as string),
      );
      expect(gated).toHaveLength(2);
      for (const f of gated) {
        expect(f.disabledWhen?.({ positionType: 0 })).toBe(true);
        expect(f.disabledWhen?.({ positionType: 1 })).toBe(false);
        // Unset positionType defaults to in-flow, so it must also be disabled.
        expect(f.disabledWhen?.({})).toBe(true);
      }
    });

    // Drawn as a checkbox above the fields it gates, and deliberately the SAME
    // `positionType` the Layout group's Flow selector writes — the two mirror each
    // other, so neither may drift onto a different path.
    it('should drive positionType from the flow checkbox above Anchor and Position', () => {
      const position = fieldsIn('UiEntity', 'Position');
      const checkbox = position.find(f => f.label === 'Ignore layout flow');
      expect(checkbox?.kind).toBe('position-mode');
      expect(checkbox?.path).toBe('positionType');
      expect(checkbox?.core).toBe(true);
      // It leads the group: a master switch belongs above what it enables.
      expect(position[0]).toBe(checkbox);

      const flow = fieldsIn('UiEntity', 'Layout').find(f => f.label === 'Flow');
      expect(flow?.kind).toBe('flow');
      expect(flow?.componentId).toBe(checkbox?.componentId);
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
      expect(visibleRawRows({ ...inCell, positionType: ABSOLUTE })).toEqual(['Flex direction']);
      // …and the direction it is hiding survives in source either way.
      expect(visibleRawRows({ ...inCell, flexDirection: 1 })).toEqual([]);
    });

    it('should reveal both alignment rows for a distributing justifyContent', () => {
      expect(
        visibleRawRows({ justifyContent: JUSTIFY_SPACE_BETWEEN, alignItems: ALIGN_START }),
      ).toEqual(['Justify content', 'Align items']);
    });

    it('should reveal both alignment rows for a stretch alignItems', () => {
      expect(visibleRawRows({ justifyContent: JUSTIFY_START, alignItems: ALIGN_STRETCH })).toEqual([
        'Justify content',
        'Align items',
      ]);
    });

    // The asymmetric state is what makes the values above reachable: adding
    // `Justify content` from `+ Add property` seeds it while alignItems is still
    // unset, which has no cell — so the row appears and can then be set to
    // Space between.
    it('should reveal both alignment rows when only one of the pair is authored', () => {
      expect(visibleRawRows({ justifyContent: JUSTIFY_START })).toEqual([
        'Justify content',
        'Align items',
      ]);
    });

    it('should reveal Flex wrap only for wrap-reverse', () => {
      for (const flexWrap of [WRAP_NO, WRAP_YES]) {
        expect(visibleRawRows({ ...inCell, flexWrap })).toEqual([]);
      }
      expect(visibleRawRows({ ...inCell, flexWrap: WRAP_REVERSE })).toEqual(['Flex wrap']);
    });

    // Adding it has to leave a VISIBLE row. Seeded at nowrap the row would hide
    // again instantly and the menu entry would read as a no-op while still writing
    // `flexWrap: 0` to source, so the seed is the one value Flow cannot express.
    it('should seed Flex wrap at the value that keeps its row on screen', () => {
      const flexWrap = fieldsIn('UiEntity', 'Layout').find(f => f.label === 'Flex wrap');
      expect(flexWrap?.defaultValue).toBe(WRAP_REVERSE);
      expect(visibleRawRows({ ...inCell, flexWrap: flexWrap?.defaultValue })).toEqual([
        'Flex wrap',
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
      expect(hidden).toEqual(['Ignore layout flow', 'Anchor', 'Position']);
    });

    it('should keep Z-index on a root, where stacking between roots is still real', () => {
      const zIndex = fieldsIn('UiEntity', 'Position').find(f => f.label === 'Z-index');
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

  describe('and a row is paired into two columns', () => {
    // The design pairs Transparency·Corner radius. It does NOT pair the border
    // row here: a colour control is swatch + hex + alpha, and a ~140px half-track
    // leaves the hex input around 44px.
    it('should mark exactly the fields the design pairs', () => {
      for (const type of ALL_TYPES) {
        const half = buildGroups(type)
          .flatMap(g => g.fields)
          .filter(f => f.half)
          .map(f => f.label);
        expect(half).toEqual(['Opacity', 'Corner radius']);
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

    it('should not expose the same field in two groups', () => {
      for (const type of ALL_TYPES) {
        const seen = allLabels(type);
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
    });
  });
});
