import { describe, it, expect } from 'vitest';

import { mergeLayout, repairMalformedParams } from './layout';
import type { ScriptLayout } from './types';

describe('mergeLayout', () => {
  describe('when merging slider params', () => {
    it('should take min, max and step from the fresh parse and keep the stored value', () => {
      const source: ScriptLayout = {
        params: { speed: { type: 'slider', value: 1, min: 0, max: 20, step: 2 } },
      };
      const target: ScriptLayout = {
        params: { speed: { type: 'slider', value: 8, min: 0, max: 10, step: 0.5 } },
      };
      expect(mergeLayout(source, target).params.speed).toEqual({
        type: 'slider',
        value: 8,
        min: 0,
        max: 20,
        step: 2,
      });
    });

    it('should clamp the stored value when it falls outside the new range', () => {
      const source: ScriptLayout = {
        params: { speed: { type: 'slider', value: 0, min: 0, max: 5, step: 1 } },
      };
      const target: ScriptLayout = {
        params: { speed: { type: 'slider', value: 8, min: 0, max: 10, step: 1 } },
      };
      expect(mergeLayout(source, target).params.speed).toMatchObject({ value: 5 });
    });
  });

  describe('when a param changes type between slider and number', () => {
    it('should keep the fresh param and drop the stored one', () => {
      const source: ScriptLayout = {
        params: { speed: { type: 'slider', value: 1, min: 0, max: 10, step: 1 } },
      };
      const target: ScriptLayout = {
        params: { speed: { type: 'number', value: 42 } },
      };
      expect(mergeLayout(source, target).params.speed).toEqual({
        type: 'slider',
        value: 1,
        min: 0,
        max: 10,
        step: 1,
      });
    });
  });

  describe('when merging non-slider params', () => {
    it('should keep the stored value', () => {
      const source: ScriptLayout = {
        params: { title: { type: 'string', value: '' } },
      };
      const target: ScriptLayout = {
        params: { title: { type: 'string', value: 'hello' } },
      };
      expect(mergeLayout(source, target).params.title).toMatchObject({ value: 'hello' });
    });
  });

  describe('when merging object params', () => {
    it('keeps stored field values, adds new keys from source, and drops removed keys', () => {
      const source: ScriptLayout = {
        params: {
          cfg: {
            type: 'object',
            value: { enabled: false, retries: 3 },
            fields: {
              enabled: { type: 'boolean', value: false },
              retries: { type: 'number', value: 3 },
            },
          },
        },
      };
      const target: ScriptLayout = {
        params: {
          cfg: {
            type: 'object',
            // stored: `enabled` edited to true, `legacy` key no longer in source, `retries` absent
            value: { enabled: true, legacy: 'x' },
            fields: {
              enabled: { type: 'boolean', value: false },
              legacy: { type: 'string', value: '' },
            },
          },
        },
      };
      expect(mergeLayout(source, target).params.cfg).toMatchObject({
        type: 'object',
        value: { enabled: true, retries: 3 },
      });
      const merged = mergeLayout(source, target).params.cfg;
      expect(merged.type === 'object' && 'legacy' in merged.value).toBe(false);
    });
  });

  describe('when merging array params', () => {
    it('preserves stored rows against the fresh item shape', () => {
      const source: ScriptLayout = {
        params: {
          items: {
            type: 'array',
            value: [],
            item: {
              type: 'object',
              value: { entity: 0, label: '' },
              fields: {
                entity: { type: 'entity', value: 0 },
                label: { type: 'string', value: '' },
              },
            },
          },
        },
      };
      const target: ScriptLayout = {
        params: {
          items: {
            type: 'array',
            value: [
              { entity: 512, label: 'a' },
              { entity: 513, label: 'b' },
            ],
            item: {
              type: 'object',
              value: { entity: 0, label: '' },
              fields: {
                entity: { type: 'entity', value: 0 },
                label: { type: 'string', value: '' },
              },
            },
          },
        },
      };
      expect(mergeLayout(source, target).params.items).toMatchObject({
        type: 'array',
        value: [
          { entity: 512, label: 'a' },
          { entity: 513, label: 'b' },
        ],
      });
    });
  });
});

// Creator Hub 0.52 rendered object and list params as text boxes and saved what was typed over
// them, keeping `type: 'object'` (#1765).
describe('repairMalformedParams', () => {
  const adminSource = `
    import type { Entity } from '@dcl/sdk/ecs';
    export class AdminTools {
      constructor(
        public src: string,
        public entity: Entity,
        public adminPermissions: 'PUBLIC' | 'PRIVATE' = 'PUBLIC',
        public authorizedAdminUsers: {
          me: boolean;
          sceneOwners: boolean;
          adminAllowList: string[];
        } = { me: true, sceneOwners: true, adminAllowList: [] },
        public smartItemsControl: {
          isEnabled: boolean;
          smartItems: Array<{ entity: Entity; customName: string }>;
        } = { isEnabled: true, smartItems: [] },
      ) {}
    }
  `;

  const corrupted: ScriptLayout = {
    params: {
      adminPermissions: { type: 'enum', value: 'PRIVATE', options: ['PUBLIC', 'PRIVATE'] },
      authorizedAdminUsers: {
        type: 'object',
        value: '[object Object]' as unknown as Record<string, unknown>,
        fields: {
          me: { type: 'boolean', value: false },
          sceneOwners: { type: 'boolean', value: false },
          adminAllowList: { type: 'array', value: [], item: { type: 'string', value: '' } },
        },
      },
      smartItemsControl: {
        type: 'object',
        value: { isEnabled: false, smartItems: 'oops' },
        fields: {
          isEnabled: { type: 'boolean', value: false },
          smartItems: {
            type: 'array',
            value: [],
            item: {
              type: 'object',
              value: { entity: 0, customName: '' },
              fields: {
                entity: { type: 'entity', value: 0 },
                customName: { type: 'string', value: '' },
              },
            },
          },
        },
      },
      removedFromSource: { type: 'string', value: 'kept' },
    },
  };

  it('restores the declared defaults and keeps every well-formed value', () => {
    const layout = repairMalformedParams(corrupted, adminSource);
    expect(layout?.params.adminPermissions.value).toBe('PRIVATE');
    expect(layout?.params.authorizedAdminUsers.value).toEqual({
      me: true,
      sceneOwners: true,
      adminAllowList: [],
    });
    expect(layout?.params.smartItemsControl.value).toEqual({ isEnabled: false, smartItems: [] });
  });

  it('touches only the malformed params', () => {
    const layout = repairMalformedParams(corrupted, adminSource);
    expect(layout?.params.adminPermissions).toBe(corrupted.params.adminPermissions);
    expect(layout?.params.removedFromSource).toEqual({ type: 'string', value: 'kept' });
  });

  it('returns undefined when nothing is malformed', () => {
    const healthy = repairMalformedParams(corrupted, adminSource)!;
    expect(repairMalformedParams(healthy, adminSource)).toBeUndefined();
  });

  it('returns undefined when the script no longer parses', () => {
    expect(repairMalformedParams(corrupted, 'export class Broken {')).toBeUndefined();
  });
});

describe('mergeLayout with object params', () => {
  it('fills a missing key from the declared default, not the type default', () => {
    const source: ScriptLayout = {
      params: {
        cfg: {
          type: 'object',
          value: { me: true, sceneOwners: true },
          fields: {
            me: { type: 'boolean', value: false },
            sceneOwners: { type: 'boolean', value: false },
          },
        },
      },
    };
    const target: ScriptLayout = {
      params: {
        cfg: {
          type: 'object',
          value: { me: false },
          fields: { me: { type: 'boolean', value: false } },
        },
      },
    };
    expect(mergeLayout(source, target).params.cfg.value).toEqual({ me: false, sceneOwners: true });
  });

  it('treats only own keys as stored, so a field named like an Object method keeps its value', () => {
    const source: ScriptLayout = {
      params: {
        cfg: {
          type: 'object',
          value: { constructor: 'declared', toString: 'declared' },
          fields: {
            constructor: { type: 'string', value: '' },
            toString: { type: 'string', value: '' },
          },
        },
      },
    };
    const target: ScriptLayout = {
      params: {
        cfg: {
          type: 'object',
          value: { toString: 'edited' },
          fields: source.params.cfg.type === 'object' ? source.params.cfg.fields : {},
        },
      },
    };
    const merged = mergeLayout(source, target).params.cfg.value;
    expect(JSON.parse(JSON.stringify(merged))).toEqual({
      constructor: 'declared',
      toString: 'edited',
    });
  });
});
