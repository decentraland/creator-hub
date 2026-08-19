import { describe, expect, it } from 'vitest';

import {
  classifyNode,
  matchesFilter,
  nodeLabelText,
  previewBoundText,
  visibleRange,
} from './tree-model';
import type { UINode } from './tree-model';

describe('visibleRange', () => {
  const node = (entity: number, children: UINode[] = []): UINode =>
    ({ entity, type: 'UiEntity', name: 'UiEntity', children }) as unknown as UINode;
  // 1 ── 2 ── 3
  //  │    └── 4
  //  └── 5
  const tree = node(1, [node(2, [node(3), node(4)]), node(5)]);
  const children = (n: UINode) => n.children;
  const allOpen = () => true;
  const e = (n: number) => n as unknown as UINode['entity'];

  it('selects the visible rows between anchor and target, target last', () => {
    expect(visibleRange(tree, children, allOpen, e(2), e(5))).toEqual([2, 3, 4, 5]);
  });

  it('reverses the slice when the anchor sits below the target', () => {
    expect(visibleRange(tree, children, allOpen, e(5), e(2))).toEqual([5, 4, 3, 2]);
  });

  it('skips rows hidden inside a collapsed subtree', () => {
    const collapsed2 = (n: UINode) => n.entity !== e(2);
    expect(visibleRange(tree, children, collapsed2, e(1), e(5))).toEqual([1, 2, 5]);
  });

  it('falls back to the target alone when the anchor is not visible', () => {
    const collapsed2 = (n: UINode) => n.entity !== e(2);
    expect(visibleRange(tree, children, collapsed2, e(3), e(5))).toEqual([5]);
  });

  it('returns empty when the target is not visible', () => {
    const collapsed2 = (n: UINode) => n.entity !== e(2);
    expect(visibleRange(tree, children, collapsed2, e(1), e(4))).toEqual([]);
  });
});

describe('classifyNode', () => {
  it('classifies a UiEntity with a background texture as an Image', () => {
    const uiBackground = { texture: { tex: { $case: 'texture', texture: { src: 'a.png' } } } };
    expect(classifyNode({ type: 'UiEntity', uiBackground })).toBe('Image');
  });

  it('classifies a UiEntity with an avatar texture as an Image', () => {
    const uiBackground = {
      texture: { tex: { $case: 'avatarTexture', avatarTexture: { userId: 'u' } } },
    };
    expect(classifyNode({ type: 'UiEntity', uiBackground })).toBe('Image');
  });

  it('classifies a UiEntity without a texture as a Container', () => {
    expect(classifyNode({ type: 'UiEntity' })).toBe('Container');
    expect(classifyNode({ type: 'UiEntity', uiBackground: { color: { r: 1 } } })).toBe('Container');
  });

  it('classifies every other type as itself', () => {
    expect(classifyNode({ type: 'Label' })).toBe('Label');
    expect(classifyNode({ type: 'Dropdown' })).toBe('Dropdown');
  });
});

describe('previewBoundText', () => {
  const KEY = 'core::UiText.value';

  it('returns the static value when the field has no binding row', () => {
    expect(previewBoundText(undefined, KEY, 'Label')).toBe('Label');
    expect(previewBoundText([{ field: 'other', variable: 'x' }], KEY, 'Label')).toBe('Label');
  });

  it('composes mixed-content segments with [name] placeholders for bindings', () => {
    const bindings = [
      {
        field: KEY,
        variable: '',
        segments: [
          { kind: 'literal', value: 'Hola ' },
          { kind: 'binding', value: 'inputValue' },
          { kind: 'literal', value: '!!!' },
        ],
      },
    ];
    expect(previewBoundText(bindings, KEY, 'Label')).toBe('Hola [inputValue]!!!');
  });

  it('renders a whole-field binding as [name]', () => {
    expect(previewBoundText([{ field: KEY, variable: 'playerName' }], KEY, 'Label')).toBe(
      '[playerName]',
    );
  });

  it('resolves a bound variable to its default value when a resolver is given', () => {
    const resolve = (expr: string) => (expr === 'state.name' ? 'John' : undefined);
    expect(previewBoundText([{ field: KEY, variable: 'state.name' }], KEY, 'Label', resolve)).toBe(
      'John',
    );
  });

  it('resolves each binding segment of a mixed-content row', () => {
    const resolve = (expr: string) => (expr === 'state.name' ? 'John' : undefined);
    const bindings = [
      {
        field: KEY,
        variable: '',
        segments: [
          { kind: 'literal', value: 'Hello: ' },
          { kind: 'binding', value: 'state.name' },
        ],
      },
    ];
    expect(previewBoundText(bindings, KEY, 'Label', resolve)).toBe('Hello: John');
  });

  it('falls back to [expr] when the resolver has no value (e.g. a marker)', () => {
    const resolve = () => undefined;
    expect(previewBoundText([{ field: KEY, variable: 'score' }], KEY, 'Label', resolve)).toBe(
      '[score]',
    );
  });
});

describe('when filtering the node tree by name', () => {
  const node = (over: Partial<UINode> & { entity: number }): UINode =>
    ({ type: 'UiEntity', name: 'UiEntity', children: [], ...over }) as unknown as UINode;

  it('should match a node whose label contains the term', () => {
    expect(matchesFilter(node({ entity: 1, type: 'Label', name: 'Label' }), 'lab')).toBe(true);
  });

  it('should keep an ancestor whose descendant matches, so the path stays navigable', () => {
    const tree = node({
      entity: 1,
      children: [
        node({ entity: 2, children: [node({ entity: 3, type: 'Button', name: 'Button' })] }),
      ],
    });
    expect(matchesFilter(tree, 'button')).toBe(true);
  });

  it('should reject a subtree with no match anywhere', () => {
    const tree = node({ entity: 1, children: [node({ entity: 2, type: 'Label', name: 'Label' })] });
    expect(matchesFilter(tree, 'dropdown')).toBe(false);
  });

  it('should label a plain UiEntity by its classified widget kind', () => {
    // The raw parse-side name is "UiEntity" for both Container and Image, so the
    // filter has to see the classified label or neither would ever match.
    expect(nodeLabelText(node({ entity: 1 }))).toBe('Container');
  });

  it('should prefer a @ui-name over the classified widget kind', () => {
    expect(nodeLabelText(node({ entity: 1, uiName: 'Sidebar' } as Partial<UINode>))).toBe(
      'Sidebar',
    );
  });

  it('should filter on a @ui-name, not just the widget kind', () => {
    const tree = node({
      entity: 1,
      children: [node({ entity: 2, uiName: 'Sidebar' } as Partial<UINode>)],
    });
    expect(matchesFilter(tree, 'sideb')).toBe(true);
    expect(matchesFilter(tree, 'label')).toBe(false);
  });

  it('should label a component wrapper by the referenced component name', () => {
    const wrapper = node({
      entity: 1,
      children: [{ ...node({ entity: 2 }), componentRef: { name: 'Card', props: [] } } as UINode],
    });
    expect(nodeLabelText(wrapper)).toBe('Card');
  });
});
