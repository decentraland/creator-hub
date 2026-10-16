import { describe, it, expect } from 'vitest';

import { mergeLayout } from './utils';
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
