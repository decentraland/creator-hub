import { describe, it, expect } from 'vitest';

import { findUnsupportedParams, hasMalformedParams } from './validation';
import type { ScriptLayout } from './types';

const layout = (params: Record<string, unknown>, actions?: unknown): ScriptLayout =>
  ({ params, actions }) as ScriptLayout;

describe('findUnsupportedParams', () => {
  it('accepts every type this editor renders, nested ones included', () => {
    const supported = layout({
      a: { type: 'number', value: 1 },
      b: {
        type: 'object',
        value: {},
        fields: { list: { type: 'array', value: [], item: { type: 'entity', value: 0 } } },
      },
    });
    expect(findUnsupportedParams(supported)).toEqual([]);
  });

  it('reports the path of each unknown type, at any depth and in actions', () => {
    const fromNewerEditor = layout(
      {
        color: { type: 'color', value: '#fff' },
        cfg: {
          type: 'object',
          value: {},
          fields: {
            rows: { type: 'array', value: [], item: { type: 'vector3', value: {} } },
          },
        },
      },
      [{ methodName: 'paint', params: { tint: { type: 'color', value: '#000' } } }],
    );
    expect(findUnsupportedParams(fromNewerEditor)).toEqual(['color', 'cfg.rows[]', 'paint(tint)']);
  });
});

describe('hasMalformedParams', () => {
  it('is false for well-formed containers', () => {
    const ok = layout({
      cfg: {
        type: 'object',
        value: { on: true },
        fields: { on: { type: 'boolean', value: false } },
      },
      list: { type: 'array', value: ['a'], item: { type: 'string', value: '' } },
    });
    expect(hasMalformedParams(ok)).toBe(false);
  });

  it('is true for an object param saved as text', () => {
    const corrupted = layout({
      cfg: { type: 'object', value: '[object Object]', fields: {} },
    });
    expect(hasMalformedParams(corrupted)).toBe(true);
  });

  it('is true for a list nested in an object that is not an array', () => {
    const corrupted = layout({
      cfg: {
        type: 'object',
        value: { rows: 'x' },
        fields: { rows: { type: 'array', value: [], item: { type: 'string', value: '' } } },
      },
    });
    expect(hasMalformedParams(corrupted)).toBe(true);
  });

  it('is false for no layout', () => {
    expect(hasMalformedParams(undefined)).toBe(false);
  });
});

describe('own keys only', () => {
  it('does not treat an object field named "constructor" as stored when it is absent', () => {
    const ok = {
      params: {
        cfg: {
          type: 'object',
          value: {},
          fields: { constructor: { type: 'object', value: {}, fields: {} } },
        },
      },
    } as unknown as ScriptLayout;
    expect(hasMalformedParams(ok)).toBe(false);
  });

  it('ignores actions and params that are not the expected shape', () => {
    const odd = { params: null, actions: { not: 'an array' } } as unknown as ScriptLayout;
    expect(findUnsupportedParams(odd)).toEqual([]);
    const nullAction = { params: {}, actions: [null] } as unknown as ScriptLayout;
    expect(findUnsupportedParams(nullAction)).toEqual([]);
  });
});
