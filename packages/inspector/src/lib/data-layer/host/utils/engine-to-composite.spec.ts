import { describe, expect, it, beforeEach } from 'vitest';
import type { IEngine } from '@dcl/ecs';
import { Engine, Schemas } from '@dcl/ecs';
import * as components from '@dcl/ecs/dist/components';

import type { FileSystemInterface } from '../../types';
import { generateUiContextsType, generateUiEntityNamesType } from './engine-to-composite';

describe('generateUiEntityNamesType', () => {
  let engine: IEngine;
  let UiTransform: ReturnType<typeof components.UiTransform>;
  let Name: ReturnType<typeof components.Name>;
  let UIMarker: ReturnType<IEngine['defineComponent']>;
  let written: string;
  let mockFs: FileSystemInterface;

  beforeEach(() => {
    engine = Engine();
    UiTransform = components.UiTransform(engine);
    Name = components.Name(engine);
    // Minimal stand-in for the asset-packs::UI marker component the generator
    // looks up via engine.getComponentOrNull('asset-packs::UI').
    UIMarker = engine.defineComponent('asset-packs::UI', { visible: Schemas.Boolean });

    written = '';
    mockFs = {
      existFile: async () => false,
      readFile: async () => Buffer.from('', 'utf-8'),
      writeFile: async (_path: string, content: Buffer) => {
        written = content.toString('utf-8');
      },
    } as unknown as FileSystemInterface;
  });

  it('escapes author-controlled Name in the enum value (no source injection)', async () => {
    const payload = 'x"; const pwned = 1; ${y}\n//';

    const root = engine.addEntity();
    UiTransform.create(root, { parent: 0 } as never);
    UIMarker.create(root, { visible: true });

    const child = engine.addEntity();
    UiTransform.create(child, { parent: root } as never);
    Name.create(child, { value: payload });

    await generateUiEntityNamesType(engine, '/scene/ui-entity-names.ts', mockFs);

    // The emitted enum value must be a JSON-encoded literal that round-trips.
    const valueMatch = written.match(/=\s*("(?:[^"\\]|\\.)*")\s*,/);
    expect(valueMatch).not.toBeNull();
    expect(JSON.parse(valueMatch![1])).toBe(payload);

    // And it must NOT have broken out into raw, unescaped TypeScript.
    expect(written).not.toContain('= "x"; const pwned');
  });

  it('prefixes a reserved-word Name so the enum key is a valid identifier', async () => {
    const reserved = 'default';

    const root = engine.addEntity();
    UiTransform.create(root, { parent: 0 } as never);
    UIMarker.create(root, { visible: true });

    const child = engine.addEntity();
    UiTransform.create(child, { parent: root } as never);
    Name.create(child, { value: reserved });

    await generateUiEntityNamesType(engine, '/scene/ui-entity-names.ts', mockFs);

    // The bare enum key must NOT be the reserved word (`default = ...` is a
    // syntax error inside `enum { ... }`); it must be the `_`-prefixed form.
    expect(written).toContain('_default =');
    expect(written).not.toMatch(/^\s*default\s*=/m);

    // The enum VALUE must still round-trip the original reserved word.
    const valueMatch = written.match(/=\s*("(?:[^"\\]|\\.)*")\s*,/);
    expect(valueMatch).not.toBeNull();
    expect(JSON.parse(valueMatch![1])).toBe(reserved);
  });
});

describe('generateUiContextsType', () => {
  let engine: IEngine;
  let UiTransform: ReturnType<typeof components.UiTransform>;
  let UIMarker: ReturnType<IEngine['defineComponent']>;
  let written: string;
  let mockFs: FileSystemInterface;

  beforeEach(() => {
    engine = Engine();
    UiTransform = components.UiTransform(engine);
    // Marker carrying the fields generateUiContextsType reads: name + variables.
    UIMarker = engine.defineComponent('asset-packs::UI', {
      name: Schemas.String,
      variables: Schemas.Array(Schemas.Map({ name: Schemas.String, type: Schemas.String })),
    });

    written = '';
    mockFs = {
      existFile: async () => false,
      readFile: async () => Buffer.from('', 'utf-8'),
      writeFile: async (_path: string, content: Buffer) => {
        written = content.toString('utf-8');
      },
    } as unknown as FileSystemInterface;
  });

  it('prefixes reserved-word marker + variable names so the interface compiles', async () => {
    const root = engine.addEntity();
    UiTransform.create(root, { parent: 0 } as never);
    UIMarker.create(root, {
      name: 'default',
      variables: [{ name: 'function', type: 'string' }],
    });

    await generateUiContextsType(engine, '/scene/ui-contexts.ts', mockFs);

    // Interface type name derived from the reserved marker name is prefixed.
    expect(written).toContain('export interface _defaultContext');
    expect(written).not.toContain('export interface defaultContext');

    // Member name derived from the reserved variable name is prefixed.
    expect(written).toContain('_function: string;');
    expect(written).not.toMatch(/^\s*function:\s*string;/m);
  });
});
