import { describe, expect, it, beforeEach } from 'vitest';
import type { IEngine } from '@dcl/ecs';
import { Engine, Schemas } from '@dcl/ecs';
import * as components from '@dcl/ecs/dist/components';

import type { FileSystemInterface } from '../../types';
import { generateUiEntityNamesType } from './engine-to-composite';

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
});
