import { describe, expect, it } from 'vitest';

import {
  getLatestVersionName,
  VERSIONS_REGISTRY,
} from '../../../sdk/components/versioning/registry';
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

  describe('when the scene carries persisted inspector UI state', () => {
    // Deliberately serialized, unlike Selection — a future "strip editor
    // components" sweep would break mode restore.
    //
    // The expected name is resolved from the registry, not hard-coded: every new
    // version diff renames the serialized component (`inspector::UIState` → `-v1`
    // → …), which would fail a literal on each future bump for no real reason.
    it('should serialize the latest inspector::UIState version with the persisted mode', () => {
      const { engine, components } = createEngineContext();
      components.InspectorUIState.create(engine.RootEntity, { uiDesignerOpen: true });

      const composite = dumpEngineToComposite(engine, 'json');
      const latest = getLatestVersionName('inspector::UIState');
      const uiState = composite.components.find(c => c.name === latest);

      expect(uiState).toBeDefined();
      expect(uiState?.data.get(engine.RootEntity)).toMatchObject({
        data: { $case: 'json', json: { uiDesignerOpen: true } },
      });
    });

    // The wire-compat guarantee the version split exists for: V0 keeps exactly the
    // members it shipped with in @dcl/inspector 7.34.x. See the registry entry.
    it('should keep V0 of inspector::UIState at its shipped shape', () => {
      const versions = VERSIONS_REGISTRY['inspector::UIState'];
      expect(versions[0].versionName).toBe('inspector::UIState');
      expect(Object.keys(versions[0].component)).toEqual(['sceneInfoPanelVisible']);
      expect(getLatestVersionName('inspector::UIState')).not.toBe('inspector::UIState');
    });
  });
});
