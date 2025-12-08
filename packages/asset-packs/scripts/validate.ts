import { getTriggerComponent, assertValidTriggerComponent } from '../src/types';
import { LocalFileSystem } from './utils/local';

async function main() {
  const local = new LocalFileSystem('./packs');
  const assetPacks = await local.getAssetPacks();
  for (const assetPack of assetPacks) {
    const assetsPath = local.getAssetsPath(assetPack.name);
    const assets = await local.getAssets(assetsPath);
    for (const asset of assets) {
      console.log(asset.name, '✅');
      const triggerComponent = getTriggerComponent(asset);
      if (triggerComponent) assertValidTriggerComponent(asset.name, triggerComponent);
    }
    console.log(assetPack.name, '✅');
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
