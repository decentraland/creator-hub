import { getTriggerComponent, assertValidTriggerComponent } from '../src/types';
import { validateComposite } from '../src/validation';
import type { ValidationError } from '../src/validation';
import { LocalFileSystem } from './utils/local';

async function main() {
  const local = new LocalFileSystem('./packs');
  const assetPacks = await local.getAssetPacks();
  const allErrors: ValidationError[] = [];

  for (const assetPack of assetPacks) {
    const assetsPath = local.getAssetsPath(assetPack.name);
    const assets = await local.getAssets(assetsPath);
    for (const asset of assets) {
      // Existing validation: trigger action refs must have id and name
      const triggerComponent = getTriggerComponent(asset);
      if (triggerComponent) assertValidTriggerComponent(asset.name, triggerComponent);

      // Composite component dependency validation
      const errors = validateComposite(asset.composite.components, asset.name);
      for (const error of errors) {
        const prefix = error.severity === 'error' ? '❌' : '⚠️';
        console.error(`${prefix} [${error.rule}] ${error.message}`);
        if (error.severity === 'error') allErrors.push(error);
      }

      console.log(asset.name, '✅');
    }
    console.log(assetPack.name, '✅');
  }

  if (allErrors.length > 0) {
    console.error(`\n${allErrors.length} validation error(s) found:`);
    allErrors.forEach(e => console.error(`  ❌ [${e.rule}] ${e.message}`));
    process.exit(1);
  }

  console.log('\nAll assets validated successfully ✅');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
