import { describe, it, expect } from 'vitest';
import { Engine } from '@dcl/ecs';
import type { AdminTools } from '../src/definitions';
import { createComponents, getComponents } from '../src/definitions';
import {
  setAdminConfig,
  getAdminConfig,
  getAdminConfigOrNull,
  getAdminEntityOrNull,
} from '../src/admin-toolkit-ui/config';

// `setAdminConfig` writes module-global state with no reset, so the legacy-path tests (no
// injection) run first and the injection test runs last within this file.

describe('config funnel — legacy component path (before any injection)', () => {
  it('returns null when nothing is injected and there is no admin component', () => {
    const engine = Engine();
    createComponents(engine);
    expect(getAdminConfigOrNull(engine)).toBeNull();
    expect(getAdminEntityOrNull(engine)).toBeNull();
    expect(() => getAdminConfig(engine)).toThrow();
  });

  it('reads the AdminTools component off the engine when one is present', () => {
    const engine = Engine();
    createComponents(engine);
    const { AdminTools } = getComponents(engine);
    const entity = engine.addEntity();
    AdminTools.create(entity);

    expect(getAdminConfigOrNull(engine)).not.toBeNull();
    expect(() => getAdminConfig(engine)).not.toThrow();
    expect(getAdminEntityOrNull(engine)).toBe(entity);
  });
});

describe('config funnel — injected script path', () => {
  it('returns the injected config and entity, regardless of the engine component', () => {
    const engine = Engine();
    createComponents(engine);
    const injected = { adminPermissions: 'PRIVATE' } as unknown as AdminTools;
    const injectedEntity = engine.addEntity();
    setAdminConfig(injected, injectedEntity);

    expect(getAdminConfig(engine)).toBe(injected);
    expect(getAdminConfigOrNull(engine)).toBe(injected);
    expect(getAdminEntityOrNull(engine)).toBe(injectedEntity);
  });
});
