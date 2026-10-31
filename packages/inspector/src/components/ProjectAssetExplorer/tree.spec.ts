import { Filter } from './Filters/types';
import { buildAssetTree, buildBuiltInAnimationsFolder } from './utils';
import {
  countMatches,
  generateAssetTree,
  getChildren,
  getEmptiedFolders,
  getTiles,
  ROOT,
} from './tree';

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

describe('getEmptiedFolders', () => {
  let tree: ReturnType<typeof generateAssetTree>['tree'];

  beforeEach(() => {
    const catalog = buildAssetTree([
      'models/chair.glb',
      'props/rocks/boulder.glb',
      'props/rocks/pebble.glb',
      'props/trees/pine.glb',
    ]).children as Parameters<typeof generateAssetTree>[0];
    tree = generateAssetTree(catalog, new Set()).tree;
  });

  describe('when the only item of a folder leaves', () => {
    it('should return that folder', () => {
      expect(getEmptiedFolders(tree, ['models/chair.glb'])).toEqual(['models']);
    });
  });

  describe('when the folder keeps another item', () => {
    it('should return nothing', () => {
      expect(getEmptiedFolders(tree, ['props/rocks/boulder.glb'])).toEqual([]);
    });
  });

  describe('when every item of a folder leaves', () => {
    it('should return the folder once', () => {
      expect(
        getEmptiedFolders(tree, ['props/rocks/boulder.glb', 'props/rocks/pebble.glb']),
      ).toEqual(['props/rocks']);
    });
  });

  describe('when a folder leaves with its parent left empty', () => {
    it('should return the parent but not the folder that leaves', () => {
      expect(getEmptiedFolders(tree, ['props/rocks', 'props/trees'])).toEqual(['props']);
    });
  });

  describe('when a top-level folder leaves', () => {
    it('should not return the root', () => {
      expect(getEmptiedFolders(tree, ['models'])).toEqual([]);
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

describe('when filtering or searching the folder tree', () => {
  const nested = buildAssetTree([
    'Models/example/model.glb',
    'Models/other/chair.glb',
    'scene/main.composite',
    'scene/thumb.png',
  ]).children as Parameters<typeof generateAssetTree>[0];
  const { tree } = generateAssetTree(nested, new Set());

  const names = (nodeId: string, search: string, filter: Filter) =>
    getTiles(nodeId, tree, search, filter).map(node => node.name);

  it('should keep every folder in the tree, whatever is searched or filtered', () => {
    const folderNames = [...tree.values()].filter(node => node.type === 'folder').map(n => n.name);
    expect(folderNames).toEqual(expect.arrayContaining(['Models', 'example', 'other', 'scene']));
    expect(getChildren(ROOT, tree)).toEqual(['Models', 'scene']);
  });

  it('should list matches from every folder when the root is selected', () => {
    expect(names(ROOT, '', Filter.Models)).toEqual(['model.glb', 'chair.glb']);
  });

  it('should narrow the results to the selected folder', () => {
    expect(names('Models/other', '', Filter.Models)).toEqual(['chair.glb']);
    expect(names('scene', '', Filter.Models)).toEqual([]);
  });

  it('should count matches per folder, leaving out folders without any', () => {
    const counts = countMatches(tree, '', Filter.Models);
    expect(Object.fromEntries(counts)).toEqual({
      Models: 2,
      'Models/example': 1,
      'Models/other': 1,
    });
  });

  it('should count search matches by file name', () => {
    expect(Object.fromEntries(countMatches(tree, 'chair', Filter.All))).toEqual({
      Models: 1,
      'Models/other': 1,
    });
  });
});
