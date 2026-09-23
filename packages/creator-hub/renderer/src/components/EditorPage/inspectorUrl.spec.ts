import { describe, expect, it } from 'vitest';

import { buildInspectorUrl } from './inspectorUrl';

import type { Project, ProjectInfo } from '/shared/types/projects';

import type { InspectorUrlInput } from './inspectorUrl';

function baseInput(overrides: Partial<InspectorUrlInput> = {}): InspectorUrlInput {
  return {
    inspectorPort: 8000,
    useBevy: false,
    supportsUiDesigner: true,
    bevyRealm: null,
    project: undefined,
    userId: null,
    ...overrides,
  };
}

function buildParams(overrides: Partial<InspectorUrlInput> = {}): URLSearchParams {
  return new URLSearchParams(new URL(buildInspectorUrl(baseInput(overrides))).search);
}

function fakeProject(info: Partial<ProjectInfo> = {}): Project {
  return {
    id: 'project-1',
    scene: { base: '10,20', parcels: ['10,20'] },
    info: { id: 'project-1', skipPublishWarning: false, ...info },
  } as unknown as Project;
}

describe('buildInspectorUrl', () => {
  describe('when building the url with the default input', () => {
    it('should enable the UI editor', () => {
      expect(buildParams().get('uiEditorEnabled')).toBe('true');
    });

    it('should point the inspector at the host window for the scene RPC channel', () => {
      expect(buildParams().has('dataLayerRpcParentUrl')).toBe(true);
    });

    it('should tell the inspector where to load the asset packs bundle', () => {
      expect(buildParams().has('binIndexJsUrl')).toBe(true);
    });

    it('should identify the host application to analytics', () => {
      expect(buildParams().get('segmentAppId')).toBe('creator-hub');
    });
  });

  describe("when the scene's sdk does not support the UI designer", () => {
    it('should still enable the UI editor', () => {
      expect(buildParams({ supportsUiDesigner: false }).get('uiEditorEnabled')).toBe('true');
    });

    it('should report the UI editor as unsupported', () => {
      expect(buildParams({ supportsUiDesigner: false }).get('uiEditorSupported')).toBe('false');
    });
  });

  describe("when the scene's sdk supports the UI designer", () => {
    it('should report the UI editor as supported', () => {
      expect(buildParams({ supportsUiDesigner: true }).get('uiEditorSupported')).toBe('true');
    });
  });

  describe('when the host selects the bevy renderer', () => {
    it('should tell the inspector to use bevy', () => {
      expect(buildParams({ useBevy: true }).get('renderer')).toBe('bevy');
    });
  });

  describe('when the host selects the bevy renderer with a live realm', () => {
    const bevyRealm = { url: 'https://realm.example', wsUrl: 'ws://localhost:9000' };

    it('should route the data layer through the realm websocket', () => {
      expect(buildParams({ useBevy: true, bevyRealm }).get('dataLayerRpcWsUrl')).toBe(
        'ws://localhost:9000',
      );
    });

    it('should pass the realm url to the engine', () => {
      expect(buildParams({ useBevy: true, bevyRealm }).get('bevyRealm')).toBe(
        'https://realm.example',
      );
    });

    it("should place the engine at the scene's base parcel", () => {
      expect(
        buildParams({ useBevy: true, bevyRealm, project: fakeProject() }).get('bevyPosition'),
      ).toBe('10,20');
    });

    it('should point the engine at the editor agent scene', () => {
      expect(buildParams({ useBevy: true, bevyRealm }).has('bevySystemScene')).toBe(true);
    });
  });

  describe('when the host selects the babylon renderer', () => {
    it('should tell the inspector to use babylon', () => {
      expect(buildParams({ useBevy: false }).get('renderer')).toBe('babylon');
    });
  });

  describe('when a project is open', () => {
    it('should identify the project to the inspector', () => {
      expect(buildParams({ project: fakeProject() }).get('projectId')).toBe('project-1');
    });

    it('should start in 3D when the project has no persisted 2D mode', () => {
      expect(buildParams({ project: fakeProject() }).get('uiDesignerOpen')).toBe('false');
    });

    it('should start in 2D when the project persisted the UI designer as open', () => {
      expect(
        buildParams({ project: fakeProject({ uiDesignerOpen: true }) }).get('uiDesignerOpen'),
      ).toBe('true');
    });

    it('should identify the user to analytics', () => {
      expect(buildParams({ project: fakeProject(), userId: 'user-1' }).get('segmentUserId')).toBe(
        'user-1',
      );
    });
  });
});
