import { engine } from '@dcl/ecs';
import { initAssetPacks } from './scene-entrypoint';

initAssetPacks(engine, {});

export function main() {
  console.log('Scene ready');
}
