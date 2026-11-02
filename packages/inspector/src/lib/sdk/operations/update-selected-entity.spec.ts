import type { IEngine } from '@dcl/ecs';
import { Engine } from '@dcl/ecs';

import type { EditorComponents } from '../components';
import { createEditorComponents } from '../components';
import { updateSelectedEntity } from './update-selected-entity';

vi.mock('../../../redux/store', () => ({ store: { dispatch: vi.fn() } }));

describe('updateSelectedEntity', () => {
  let engine: IEngine;
  let Selection: EditorComponents['Selection'];

  beforeEach(() => {
    engine = Engine();
    Selection = createEditorComponents(engine).Selection;
  });

  describe('when the scene has no Nodes root', () => {
    it('should select the entity instead of throwing', () => {
      const entity = engine.addEntity();
      expect(() => updateSelectedEntity(engine)(entity, true)).not.toThrow();
      expect(Selection.has(entity)).toBe(true);
    });
  });
});
