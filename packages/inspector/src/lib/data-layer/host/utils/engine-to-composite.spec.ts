import { describe, expect, it } from 'vitest';

import { createEngineContext } from './engine';
import { dumpEngineToComposite } from './engine-to-composite';

describe('dumpEngineToComposite', () => {
  describe('when an entity carries the editor-only Selection component', () => {
    // Guards the exact spelling in `ignoreComponentNames`: a one-colon typo there
    // matches nothing and leaks gizmo state into every shipped scene.
    it('should not serialize it into the composite', () => {
      const { engine, components } = createEngineContext();
      const entity = engine.addEntity();
      components.Selection.create(entity, { gizmo: 1 });

      const composite = dumpEngineToComposite(engine, 'json');

      expect(composite.components.map(c => c.name)).not.toContain('inspector::Selection');
    });

    it('should still serialize the other inspector components on that entity', () => {
      const { engine, components } = createEngineContext();
      const entity = engine.addEntity();
      components.Selection.create(entity, { gizmo: 1 });
      components.Lock.create(entity, { value: true });

      const composite = dumpEngineToComposite(engine, 'json');

      expect(composite.components.map(c => c.name)).toContain('inspector::Lock');
    });
  });

  describe('when the scene carries persisted inspector UI state', () => {
    // Deliberately serialized, unlike Selection — a future "strip editor
    // components" sweep would break mode restore.
    it('should serialize inspector::UIState with the persisted mode', () => {
      const { engine, components } = createEngineContext();
      components.InspectorUIState.create(engine.RootEntity, { uiDesignerOpen: true });

      const composite = dumpEngineToComposite(engine, 'json');
      const uiState = composite.components.find(c => c.name === 'inspector::UIState');

      expect(uiState).toBeDefined();
      expect(uiState?.data.get(engine.RootEntity)).toMatchObject({
        data: { $case: 'json', json: { uiDesignerOpen: true } },
      });
    });
  });
});
