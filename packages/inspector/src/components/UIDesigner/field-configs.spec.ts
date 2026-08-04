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
  });
});
