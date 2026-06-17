import { describe, expect, it } from 'vitest';

import type { Entity } from '@dcl/ecs';

import { deepEqual, safeParse } from './ui-runtime';

const E = 0 as Entity;

describe('safeParse', () => {
  it('falls back on malformed JSON (throw path)', () => {
    expect(safeParse<Record<string, unknown>>('{', {}, E, 'transform')).toEqual({});
  });

  it('falls back on well-formed-but-wrong shapes', () => {
    expect(safeParse<Record<string, unknown>>('[1,2,3]', {}, E, 'transform')).toEqual({});
    expect(safeParse<Record<string, unknown>>('42', {}, E, 'transform')).toEqual({});
    expect(safeParse<Record<string, unknown>>('"hi"', {}, E, 'transform')).toEqual({});
    expect(safeParse<Record<string, unknown>>('null', {}, E, 'transform')).toEqual({});
    expect(
      safeParse<Record<string, unknown> | undefined>('5', undefined, E, 'text'),
    ).toBeUndefined();
  });

  it('strips prototype-polluting keys but keeps real fields', () => {
    const out = safeParse<Record<string, unknown>>(
      '{"width":1,"__proto__":{"polluted":true},"constructor":{"x":1},"prototype":{"y":1}}',
      {},
      E,
      'transform',
    );
    expect(out.width).toBe(1);
    expect(Object.prototype.hasOwnProperty.call(out, '__proto__')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(out, 'constructor')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(out, 'prototype')).toBe(false);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});

describe('deepEqual', () => {
  it('compares shallow values correctly', () => {
    expect(deepEqual({ a: 1, b: [1, 2] }, { a: 1, b: [1, 2] })).toBe(true);
    expect(deepEqual({ a: 1 }, { a: 2 })).toBe(false);
  });

  it('does not overflow on deeply-nested distinct values, and treats them as changed', () => {
    let a: Record<string, unknown> = { leaf: 1 };
    let b: Record<string, unknown> = { leaf: 1 };
    for (let i = 0; i < 5000; i++) {
      a = { nested: a };
      b = { nested: b };
    }
    expect(() => deepEqual(a, b)).not.toThrow();
    expect(deepEqual(a, b)).toBe(false);
  });
});
