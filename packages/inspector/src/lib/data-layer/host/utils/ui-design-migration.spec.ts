import { describe, expect, it, beforeEach } from 'vitest';
import type { Entity, IEngine } from '@dcl/ecs';
import { Composite, Engine, EntityMappingMode } from '@dcl/ecs';
import * as components from '@dcl/ecs/dist/components';
import { ComponentName, createComponents } from '@dcl/asset-packs';

import { dumpEngineToComposite } from './engine-to-composite';
import { splitUIDesignToCore } from './ui-design-migration';

// Register the core UI render components + the asset-packs UIDesign component on an
// engine, mirroring the inspector editing engine (which carries both).
function setupEngine(): IEngine {
  const engine = Engine();
  components.UiTransform(engine);
  components.UiText(engine);
  components.UiInput(engine);
  components.UiDropdown(engine);
  // Registers asset-packs::UIDesign (and siblings) on the engine.
  createComponents(engine as never);
  return engine;
}

describe('when round-tripping UI Designer nodes through the composite boundary', () => {
  let source: IEngine;
  let UiTransform: ReturnType<typeof components.UiTransform>;
  let UiText: ReturnType<typeof components.UiText>;
  let root: Entity;
  let child: Entity;

  beforeEach(() => {
    source = setupEngine();
    UiTransform = components.UiTransform(source);
    UiText = components.UiText(source);

    root = source.addEntity();
    UiTransform.create(root, { parent: 0 } as never);

    child = source.addEntity();
    UiTransform.create(child, {
      parent: root,
      rightOf: root,
      width: 123,
      positionLeft: 45,
    } as never);
    UiText.create(child, { value: 'hello world' } as never);
  });

  it('dumps the core UI components as asset-packs::UIDesign and suppresses core::Ui*', () => {
    const composite = dumpEngineToComposite(source, 'json');
    const names = composite.components.map(c => c.name);

    expect(names).toContain(ComponentName.UI_DESIGN);
    expect(names).not.toContain('core::UiTransform');
    expect(names).not.toContain('core::UiText');
    expect(names).not.toContain('core::UiInput');
    expect(names).not.toContain('core::UiDropdown');
  });

  it('splits asset-packs::UIDesign back into identical core::UiTransform/UiText on load', () => {
    // Dump and JSON round-trip exactly as performSave + load do on disk.
    const dumped = dumpEngineToComposite(source, 'json');
    const json = Composite.toJson(dumped);
    const reloaded = Composite.fromJson(json);

    // Fresh engine with the same component registrations as the inspector engine.
    const target = setupEngine();
    Composite.instance(
      target,
      { src: 'main.composite', composite: reloaded },
      {
        getCompositeOrNull: () => null,
      },
      {
        entityMapping: {
          type: EntityMappingMode.EMM_DIRECT_MAPPING,
          getCompositeEntity: (entity: number | Entity) => entity as Entity,
        },
      },
    );

    // Before the split, the editor's core components carry nothing.
    const TargetUiTransform = components.UiTransform(target);
    const TargetUiText = components.UiText(target);
    const UIDesign = target.getComponent(ComponentName.UI_DESIGN);
    expect(TargetUiTransform.getOrNull(child)).toBeNull();
    expect(UIDesign.getOrNull(child)).not.toBeNull();

    splitUIDesignToCore(target);

    // UIDesign is consumed; core::* now hold the original (identity-mapped) values.
    expect(UIDesign.getOrNull(child)).toBeNull();

    const transform = TargetUiTransform.get(child) as Record<string, unknown>;
    expect(transform.parent).toBe(root);
    expect(transform.rightOf).toBe(root);
    expect(transform.width).toBe(123);
    expect(transform.positionLeft).toBe(45);

    const text = TargetUiText.get(child) as Record<string, unknown>;
    expect(text.value).toBe('hello world');

    // Root node round-trips too (parent 0, no text).
    const rootTransform = TargetUiTransform.get(root) as Record<string, unknown>;
    expect(rootTransform.parent).toBe(0);
    expect(TargetUiText.getOrNull(root)).toBeNull();
  });
});
