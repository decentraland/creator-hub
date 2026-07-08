import { parseSync } from 'oxc-parser';
import { describe, expect, it } from 'vitest';

import { YGU_POINT } from '../../../lib/sdk/ui-transform-constants';
import { codeToUINodes } from './parse-adapter';
import type { CodeUINode } from './types';

function parse(source: string) {
  const result = parseSync('MyScreen.tsx', source);
  expect(result.errors).toHaveLength(0);
  return codeToUINodes(result.program as any, source);
}

describe('when mapping parsed TSX to UI nodes', () => {
  describe('and the component returns a UiEntity tree with a Label and a loop', () => {
    const source = `/** @jsx ReactEcs.createElement */
import ReactEcs, { UiEntity, Label } from '@dcl/sdk/react-ecs'

export function MyScreen() {
  return (
    <UiEntity uiTransform={{ width: 400, height: 200 }} uiBackground={{ color: 'black' }}>
      <Label value="Hello" fontSize={24} />
      {items.map(i => <UiEntity key={i} />)}
    </UiEntity>
  )
}
`;

    it('should map the root UiEntity with statically-evaluated object props', () => {
      const parsed = parse(source);
      expect(parsed).not.toBeNull();
      const root = parsed!.root;
      expect(root.type).toBe('UiEntity');
      // uiTransform is normalized to the flattened PBUiTransform shape.
      expect(root.uiTransform).toEqual({
        width: 400,
        widthUnit: YGU_POINT,
        height: 200,
        heightUnit: YGU_POINT,
      });
      expect(root.uiBackground).toEqual({ color: 'black' });
      expect(root.opaque).toBeUndefined();
    });

    it('should fold Label text props into uiText', () => {
      const root = parse(source)!.root;
      const label = root.children.find(c => c.type === 'Label') as CodeUINode;
      expect(label).toBeDefined();
      expect(label.uiText).toEqual({ value: 'Hello', fontSize: 24 });
    });

    it('should represent the .map loop as an opaque node preserving its source', () => {
      const parsed = parse(source)!;
      expect(parsed.hasOpaque).toBe(true);
      const opaque = parsed.root.children.find(c => c.opaque) as CodeUINode;
      expect(opaque.opaque!.reason).toBe('loop');
      expect(opaque.opaque!.raw).toContain('items.map');
    });

    it('should record a source span for every node, matching the source text', () => {
      const parsed = parse(source)!;
      const root = parsed.root;
      expect(parsed.spans.get(root.entity as unknown as number)).toEqual(root.span);
      expect(source.slice(root.span[0], root.span[1]).startsWith('<UiEntity')).toBe(true);
    });
  });

  describe('and the tree contains a custom component', () => {
    const source = `export function S() {
  return (
    <UiEntity>
      <MyWidget foo={1} />
    </UiEntity>
  )
}`;

    it('should mark the custom component opaque', () => {
      const root = parse(source)!.root;
      const child = root.children[0];
      expect(child.opaque?.reason).toBe('custom-component');
      expect(child.name).toBe('MyWidget');
    });
  });

  describe('and an element uses spread props', () => {
    const source = `export function S() {
  return <UiEntity {...rest} uiTransform={{ width: 1 }} />
}`;

    it('should mark the spread element opaque', () => {
      const root = parse(source)!.root;
      expect(root.opaque?.reason).toBe('spread-props');
    });
  });

  describe('and a prop value is a non-literal expression', () => {
    const source = `export function S() {
  return <UiEntity uiTransform={dynamicTransform} />
}`;

    it('should keep the node but flag dynamicProps and skip the unresolved value', () => {
      const root = parse(source)!.root;
      expect(root.opaque).toBeUndefined();
      expect(root.dynamicProps).toBe(true);
      expect(root.uiTransform).toBeUndefined();
    });
  });

  describe('and there is no component returning JSX', () => {
    it('should return null', () => {
      const parsed = parse('export const x = 1');
      expect(parsed).toBeNull();
    });
  });
});
