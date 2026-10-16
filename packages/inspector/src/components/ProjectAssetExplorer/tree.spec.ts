import { Filter } from './Filters/types';
import { buildAssetTree, buildBuiltInAnimationsFolder } from './utils';
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

describe('when the catalog has built-in animations', () => {
  const builtIns = buildBuiltInAnimationsFolder([
    {
      id: 'wave',
      name: 'Wave',
      category: 'expressions',
      tags: [],
      composite: { version: 1, components: [] },
      contents: { 'thumbnail.png': 'hash-thumb', 'preview.webp': 'hash-preview' },
      builtInEmote: 'wave',
    },
    {
      id: 'chair',
      name: 'Chair',
      category: 'furniture',
      tags: [],
      composite: { version: 1, components: [] },
      contents: { 'chair.glb': 'hash-glb' },
    },
  ] as unknown as Parameters<typeof buildBuiltInAnimationsFolder>[0]);

  it('should list only the built-in ones in the folder', () => {
    expect(builtIns.children.map(child => child.name)).toEqual(['Wave']);
  });

  it('should group them under Avatar Animations', () => {
    const { tree } = generateAssetTree([builtIns, ...folders], new Set(), '', Filter.Emotes);
    expect(getTiles(ROOT, tree, '', Filter.Emotes).map(node => node.name)).toEqual([
      'Wave',
      'Avatar_Dance_emote.glb',
    ]);
  });
});
