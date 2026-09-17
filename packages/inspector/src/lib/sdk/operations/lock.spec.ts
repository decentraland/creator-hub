import type { Entity, IEngine } from '@dcl/ecs';
import { Engine } from '@dcl/ecs';

import type { EditorComponents } from '../components';
import { createEditorComponents } from '../components';
import { lock } from './lock';

describe('lock', () => {
  let engine: IEngine;
  let Lock: EditorComponents['Lock'];
  let entity: Entity;
  let lockOperation: ReturnType<typeof lock>;

  beforeEach(() => {
    engine = Engine();
    Lock = createEditorComponents(engine).Lock;
    entity = engine.addEntity();
    lockOperation = lock(engine);
  });

  describe('when locking an unlocked entity', () => {
    beforeEach(() => {
      lockOperation(entity, true);
    });

    it('should add the Lock component to the entity', () => {
      expect(Lock.getOrNull(entity)).toStrictEqual({ value: true });
    });

    describe('and then unlocking it', () => {
      beforeEach(() => {
        lockOperation(entity, false);
      });

      it('should remove the Lock component from the entity', () => {
        expect(Lock.getOrNull(entity)).toBeNull();
      });
    });

    describe('and then locking it again', () => {
      it('should not throw and should keep the Lock component', () => {
        expect(() => lockOperation(entity, true)).not.toThrow();
        expect(Lock.getOrNull(entity)).toStrictEqual({ value: true });
      });
    });
  });

  describe('when unlocking an entity that is not locked', () => {
    it('should not throw and should leave the entity without a Lock component', () => {
      expect(() => lockOperation(entity, false)).not.toThrow();
      expect(Lock.getOrNull(entity)).toBeNull();
    });
  });
});
