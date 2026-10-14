import { Filter } from './Filters/types';
import { buildAssetTree } from './utils';
import { generateAssetTree, getTiles, ROOT } from './tree';

const folders = buildAssetTree(['asset-packs/dance/Avatar_Dance_emote.glb', 'models/chair.glb'])
  .children as Parameters<typeof generateAssetTree>[0];

function tileNames(filter: Filter) {
  const { tree } = generateAssetTree(folders, new Set(), '', filter);
  return getTiles(ROOT, tree, '', filter).map(node => node.name);
}

describe('ProjectAssetExplorer/tree', () => {
  describe('when the scene has both a model and an avatar animation', () => {
    it('should offer Models and Avatar Animations as separate groups', () => {
      const { filters } = generateAssetTree(folders, new Set());
      expect([...filters]).toEqual(expect.arrayContaining([Filter.Models, Filter.Emotes]));
    });

    it('should list only the animation under Avatar Animations', () => {
      expect(tileNames(Filter.Emotes)).toEqual(['Avatar_Dance_emote.glb']);
    });

    it('should leave the animation out of Models', () => {
      expect(tileNames(Filter.Models)).toEqual(['chair.glb']);
    });
  });
});
