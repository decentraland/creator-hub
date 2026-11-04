import { describe, expect, it, vi } from 'vitest';
import { Engine } from '@dcl/ecs';
import type { Entity } from '@dcl/ecs';
import { createComponents, getComponents } from '../src/definitions';
import {
  getAdminToolkitVideoControl,
  getVideoPlayers,
} from '../src/admin-toolkit-ui/VideoControl/utils';
import { getAdminConfig, getAdminEntityOrNull } from '../src/admin-toolkit-ui/config';

// The video helpers live beside the panel UI and its comms bus, which need the scene runtime; the
// helpers under test use neither.
vi.mock('../src/admin-toolkit-ui/admin-message-bus', () => ({ getAdminMessageBus: vi.fn() }));
vi.mock('../src/admin-toolkit-ui/VideoControl/index', () => ({ DEFAULT_VOLUME: 1 }));

// The Admin Tools item ships as an `asset-packs::AdminTools` component. The admin panel reads its
// settings through the config funnel, which must keep returning exactly what is on that component
// when no script has injected a config.

describe('when a scene has the component-based Admin Tools item', () => {
  const engine = Engine();
  createComponents(engine);
  const { AdminTools } = getComponents(engine);
  const entity = engine.addEntity();
  const screen = 600 as Entity;
  AdminTools.create(entity, {
    videoControl: {
      isEnabled: true,
      disableVideoPlayersSound: true,
      showAuthorOnVideoPlayers: false,
      linkAllVideoPlayers: false,
      videoPlayers: [{ entity: screen, customName: 'Main screen' }],
    },
  } as never);

  it('should read the settings off that component', () => {
    expect(getAdminConfig(engine)).toEqual(AdminTools.get(entity));
  });

  it("should treat the component's entity as the admin entity", () => {
    expect(getAdminEntityOrNull(engine)).toBe(entity);
  });

  it('should read the video settings off that component', () => {
    expect(getAdminToolkitVideoControl(engine)).toEqual(AdminTools.get(entity).videoControl);
  });

  it('should list the video screens the component names', () => {
    expect(getVideoPlayers(engine)).toEqual([{ entity: screen, customName: 'Main screen' }]);
  });
});

describe('when a scene has no Admin Tools item', () => {
  const engine = Engine();
  createComponents(engine);

  it('should have no video settings or screens', () => {
    expect(getAdminToolkitVideoControl(engine)).toBeNull();
    expect(getVideoPlayers(engine)).toEqual([]);
  });
});
