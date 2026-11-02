import type { Entity, IEngine, TransformComponentExtended } from '@dcl/ecs';
import { Engine } from '@dcl/ecs';

import type { EditorComponents } from '../components';
import { CoreComponents, createEditorComponents } from '../components';
import { hide } from './hide';

describe('hide', () => {
  let engine: IEngine;
  let Transform: TransformComponentExtended;
  let Hide: EditorComponents['Hide'];
  let parent: Entity;
  let child: Entity;
  let hideOperation: ReturnType<typeof hide>;

  beforeEach(() => {
    engine = Engine();
    Transform = engine.getComponent(CoreComponents.TRANSFORM) as TransformComponentExtended;
    Hide = createEditorComponents(engine).Hide;
    parent = engine.addEntity();
    child = engine.addEntity();
    Transform.create(parent, {});
    Transform.create(child, { parent });
    hideOperation = hide(engine);
  });

  describe('when hiding a visible entity', () => {
    beforeEach(() => {
      hideOperation(parent, true);
    });

    it('should add the Hide component to the entity and all its children', () => {
      expect(Hide.getOrNull(parent)).toStrictEqual({ value: true });
      expect(Hide.getOrNull(child)).toStrictEqual({ value: true });
    });

    describe('and then un-hiding it', () => {
      beforeEach(() => {
        hideOperation(parent, false);
      });

      it('should remove the Hide component from the entity and all its children', () => {
        expect(Hide.getOrNull(parent)).toBeNull();
        expect(Hide.getOrNull(child)).toBeNull();
      });
    });

    describe('and then hiding it again', () => {
      it('should not throw and should keep the Hide component on the whole tree', () => {
        expect(() => hideOperation(parent, true)).not.toThrow();
        expect(Hide.getOrNull(parent)).toStrictEqual({ value: true });
        expect(Hide.getOrNull(child)).toStrictEqual({ value: true });
      });
    });
  });

  describe('when hiding a parent whose child is already hidden', () => {
    beforeEach(() => {
      hideOperation(child, true);
    });

    it('should not throw and should hide the whole tree', () => {
      expect(() => hideOperation(parent, true)).not.toThrow();
      expect(Hide.getOrNull(parent)).toStrictEqual({ value: true });
      expect(Hide.getOrNull(child)).toStrictEqual({ value: true });
    });
  });

  describe('when un-hiding an entity that is not hidden', () => {
    it('should not throw and should leave the tree without Hide components', () => {
      expect(() => hideOperation(parent, false)).not.toThrow();
      expect(Hide.getOrNull(parent)).toBeNull();
      expect(Hide.getOrNull(child)).toBeNull();
    });
  });
});
