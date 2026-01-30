import type { IEngine } from '@dcl/ecs';
import { BaseComponentNames } from '../base-names';

const TILE_BASE_NAME = BaseComponentNames.TILE;

const TileV0 = {};

export const TILE_VERSIONS = [{ versionName: TILE_BASE_NAME, component: TileV0 }];

export function defineTileComponent(engine: IEngine) {
  return engine.defineComponent(TILE_BASE_NAME, TileV0);
}
