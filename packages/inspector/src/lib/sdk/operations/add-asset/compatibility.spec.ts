import { describe, it, expect } from 'vitest';
import type { IEngine } from '@dcl/ecs';
import type { AssetData } from '@dcl/asset-packs';

import { checkAssetCompatibility } from './compatibility';

const engine = { getComponent: () => ({}) } as unknown as IEngine;

const scriptComposite = (params: Record<string, unknown>): AssetData['composite'] => ({
  version: 1,
  components: [
    {
      name: 'asset-packs::Script',
      data: {
        '0': {
          json: {
            value: [
              {
                path: '{assetPath}/AdminTools.ts',
                priority: 0,
                layout: JSON.stringify({ params }),
              },
            ],
          },
        },
      },
    },
  ],
});

describe('checkAssetCompatibility', () => {
  it('accepts a script whose params this editor can render', () => {
    const composite = scriptComposite({
      authorizedAdminUsers: {
        type: 'object',
        value: { me: true },
        fields: { me: { type: 'boolean', value: false } },
      },
    });
    expect(checkAssetCompatibility(composite, engine)).toEqual({ compatible: true });
  });

  it('rejects a script that declares a param type this editor does not know', () => {
    const composite = scriptComposite({
      cfg: {
        type: 'object',
        value: {},
        fields: { tint: { type: 'color', value: '#fff' } },
      },
    });
    expect(checkAssetCompatibility(composite, engine)).toEqual({
      compatible: false,
      incompatibleComponents: [
        { name: 'AdminTools.ts: cfg.tint', reason: 'unsupported-script-param' },
      ],
    });
  });

  it('ignores a layout that is not valid JSON', () => {
    const composite = scriptComposite({});
    composite.components[0].data['0'].json.value[0].layout = '{not json';
    expect(checkAssetCompatibility(composite, engine)).toEqual({ compatible: true });
  });

  it('treats a malformed Script entry as having no unsupported params instead of throwing', () => {
    const composite = scriptComposite({});
    (composite.components[0].data as Record<string, unknown>)['1'] = null;
    composite.components[0].data['0'].json.value[0].layout = JSON.stringify({
      params: {},
      actions: { not: 'an array' },
    });
    expect(checkAssetCompatibility(composite, engine)).toEqual({ compatible: true });
  });
});
