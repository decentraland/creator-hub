import { describe, it, expect } from 'vitest';
import { Engine } from '@dcl/ecs';
import type { AdminTools } from '../src/definitions';
import { createComponents, getComponents } from '../src/definitions';
import {
  setAdminConfig,
  clearAdminConfig,
  getAdminConfig,
  getAdminConfigOrNull,
  getAdminEntityOrNull,
} from '../src/admin-toolkit-ui/config';

// `setAdminConfig` writes module-global state, so the legacy-path tests (no injection) run first
// and the injection tests clear what they inject.

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

  describe('and the injected config is cleared for another entity', () => {
    it('keeps the injected config', () => {
      const engine = Engine();
      createComponents(engine);
      const injected = { adminPermissions: 'PRIVATE' } as unknown as AdminTools;
      const injectedEntity = engine.addEntity();
      setAdminConfig(injected, injectedEntity);

      clearAdminConfig(engine.addEntity());

      expect(getAdminConfigOrNull(engine)).toBe(injected);
      clearAdminConfig(injectedEntity);
    });
  });

  describe('and the injected config is cleared for its own entity', () => {
    it('falls back to the AdminTools component', () => {
      const engine = Engine();
      createComponents(engine);
      const injectedEntity = engine.addEntity();
      setAdminConfig({ adminPermissions: 'PRIVATE' } as unknown as AdminTools, injectedEntity);

      clearAdminConfig(injectedEntity);

      expect(getAdminConfigOrNull(engine)).toBeNull();
      expect(getAdminEntityOrNull(engine)).toBeNull();
    });
  });
});
