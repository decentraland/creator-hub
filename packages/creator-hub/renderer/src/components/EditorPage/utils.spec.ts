import { describe, expect, it } from 'vitest';
import type { Project } from '/shared/types/projects';
import { resolveSceneMetricsTarget } from './utils';

type Target = Pick<Project, 'worldConfiguration' | 'scene'>;

const withScene = (base: string): Target['scene'] => ({ base, parcels: [base] });

describe('resolveSceneMetricsTarget', () => {
  it('resolves a World by its lowercased name', () => {
    expect(
      resolveSceneMetricsTarget({
        worldConfiguration: { name: 'Kick-Off.dcl.eth' },
        scene: withScene('0,0'),
      }),
    ).toEqual({ sceneType: 'world', sceneId: 'kick-off.dcl.eth' });
  });

  it('resolves a Genesis parcel by its base coords with a pipe separator', () => {
    expect(resolveSceneMetricsTarget({ scene: withScene('10,20') })).toEqual({
      sceneType: 'genesis',
      sceneId: '10|20',
    });
  });

  it('prefers the World target when both a world and a land base exist', () => {
    expect(
      resolveSceneMetricsTarget({
        worldConfiguration: { name: 'my-world.dcl.eth' },
        scene: withScene('10,20'),
      }),
    ).toEqual({ sceneType: 'world', sceneId: 'my-world.dcl.eth' });
  });

  it('returns null for a fresh scene at 0,0 with no world', () => {
    expect(resolveSceneMetricsTarget({ scene: withScene('0,0') })).toBeNull();
  });

  it('returns null when there is no project', () => {
    expect(resolveSceneMetricsTarget(undefined)).toBeNull();
  });
});
