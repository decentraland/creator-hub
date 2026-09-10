import type { Entity, IEngine } from '@dcl/ecs';
import { Engine } from '@dcl/ecs';

import type { SdkComponents } from '../components';
import { createComponents } from '../components';
import { getEntityScale, isAreaComponent, syncAreaWithScale } from './area-size';
import { updateValue } from './update-value';
import { addComponent } from './add-component';

describe('area-size', () => {
  let engine: IEngine;
  let components: SdkComponents;
  let entity: Entity;

  beforeEach(() => {
    engine = Engine();
    components = createComponents(engine);
    entity = engine.addEntity();
  });

  describe('isAreaComponent', () => {
    it('should return true for AvatarModifierArea and CameraModeArea', () => {
      expect(isAreaComponent('core::AvatarModifierArea')).toBe(true);
      expect(isAreaComponent('core::CameraModeArea')).toBe(true);
    });

    it('should return false for other components', () => {
      expect(isAreaComponent('core::Transform')).toBe(false);
      expect(isAreaComponent('core::GltfContainer')).toBe(false);
    });
  });

  describe('getEntityScale', () => {
    describe('when the entity has a Transform', () => {
      beforeEach(() => {
        components.Transform.create(entity, { scale: { x: 2, y: 3, z: 4 } });
      });

      it('should return the Transform scale', () => {
        expect(getEntityScale(engine, entity)).toEqual({ x: 2, y: 3, z: 4 });
      });
    });

    describe('when the entity has no Transform', () => {
      it('should return {1,1,1}', () => {
        expect(getEntityScale(engine, entity)).toEqual({ x: 1, y: 1, z: 1 });
      });
    });
  });

  describe('syncAreaWithScale', () => {
    describe('when the entity has area components', () => {
      beforeEach(() => {
        components.AvatarModifierArea.create(entity, {
          area: { x: 1, y: 1, z: 1 },
          modifiers: [],
          excludeIds: [],
        });
        components.CameraModeArea.create(entity, { area: { x: 1, y: 1, z: 1 }, mode: 0 });
      });

      it('should copy the scale into the area of every area component', () => {
        syncAreaWithScale(engine, entity, { x: 5, y: 6, z: 7 });
        expect(components.AvatarModifierArea.get(entity).area).toEqual({ x: 5, y: 6, z: 7 });
        expect(components.CameraModeArea.get(entity).area).toEqual({ x: 5, y: 6, z: 7 });
      });
    });

    describe('when the entity has no area components', () => {
      it('should not throw', () => {
        expect(() => syncAreaWithScale(engine, entity, { x: 5, y: 6, z: 7 })).not.toThrow();
      });
    });
  });

  describe('updateValue on a Transform', () => {
    let updateValueOperation: ReturnType<typeof updateValue>;

    beforeEach(() => {
      updateValueOperation = updateValue(engine);
      components.Transform.create(entity, { scale: { x: 1, y: 1, z: 1 } });
      components.CameraModeArea.create(entity, { area: { x: 1, y: 1, z: 1 }, mode: 0 });
    });

    describe('when the update carries a scale change', () => {
      it('should mirror the scale into the area of area components', () => {
        updateValueOperation(components.Transform, entity, { scale: { x: 2, y: 4, z: 8 } });
        expect(components.CameraModeArea.get(entity).area).toEqual({ x: 2, y: 4, z: 8 });
      });
    });

    describe('when the update does not carry a scale change', () => {
      it('should leave the area untouched', () => {
        updateValueOperation(components.Transform, entity, { position: { x: 9, y: 9, z: 9 } });
        expect(components.CameraModeArea.get(entity).area).toEqual({ x: 1, y: 1, z: 1 });
      });
    });

    describe('when a non-Transform component is updated', () => {
      it('should leave the area untouched', () => {
        components.Name.create(entity, { value: 'a' });
        updateValueOperation(components.Name, entity, { value: 'b' });
        expect(components.CameraModeArea.get(entity).area).toEqual({ x: 1, y: 1, z: 1 });
      });
    });
  });

  describe('addComponent for an area component', () => {
    let addComponentOperation: ReturnType<typeof addComponent>;

    beforeEach(() => {
      addComponentOperation = addComponent(engine);
    });

    describe('when the entity has a Transform', () => {
      beforeEach(() => {
        components.Transform.create(entity, { scale: { x: 3, y: 2, z: 1 } });
      });

      it('should initialize the area from the Transform scale', () => {
        addComponentOperation(entity, components.AvatarModifierArea.componentId, {
          modifiers: [0],
          excludeIds: [],
        });
        expect(components.AvatarModifierArea.get(entity).area).toEqual({ x: 3, y: 2, z: 1 });
      });
    });

    describe('when the entity has no Transform', () => {
      it('should initialize the area to {1,1,1}', () => {
        addComponentOperation(entity, components.CameraModeArea.componentId, { mode: 1 });
        expect(components.CameraModeArea.get(entity).area).toEqual({ x: 1, y: 1, z: 1 });
      });
    });

    describe('when the provided value already carries an area', () => {
      it('should keep the provided area', () => {
        addComponentOperation(entity, components.CameraModeArea.componentId, {
          mode: 0,
          area: { x: 4, y: 3, z: 4 },
        });
        expect(components.CameraModeArea.get(entity).area).toEqual({ x: 4, y: 3, z: 4 });
      });
    });
  });
});
