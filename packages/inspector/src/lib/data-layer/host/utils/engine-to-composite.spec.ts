import { describe, expect, it } from 'vitest';

import { createEngineContext } from './engine';
import { dumpEngineToComposite } from './engine-to-composite';

describe('dumpEngineToComposite', () => {
  describe('when an entity carries the editor-only Selection component', () => {
    // Guards the exact spelling in `ignoreComponentNames`: a one-colon typo matches
    // nothing and leaks gizmo state into every shipped scene.
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
});
