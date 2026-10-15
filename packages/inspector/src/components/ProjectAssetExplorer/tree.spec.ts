import { Filter } from './Filters/types';
import { buildAssetTree, buildBuiltInAnimationsFolder } from './utils';
import { generateAssetTree, getChildren, getTiles, ROOT } from './tree';

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
      category: 'built-in',
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

  const describeTree = (search: string, filter: Filter) => {
    const { tree } = generateAssetTree(nested, new Set(), search, filter);
    const lines: string[] = [];
    const walk = (id: string, depth: number) => {
      getChildren(id, tree).forEach(child => {
        lines.push(`${'  '.repeat(depth)}${tree.get(child)!.name}`);
        walk(child, depth + 1);
      });
    };
    walk(ROOT, 0);
    return lines;
  };

  it('should keep every folder when nothing is filtered', () => {
    expect(describeTree('', Filter.All)).toEqual([
      'Models',
      '  example',
      '    model.glb',
      '  other',
      '    chair.glb',
      'scene',
      '  main.composite',
      '  thumb.png',
    ]);
  });

  it('should keep the folders leading to a type filter match, and drop the rest', () => {
    expect(describeTree('', Filter.Models)).toEqual([
      'Models',
      '  example',
      '    model.glb',
      '  other',
      '    chair.glb',
    ]);
  });

  it('should keep the hierarchy of a search match, however deeply nested', () => {
    expect(describeTree('chair', Filter.All)).toEqual(['Models', '  other', '    chair.glb']);
  });

  it('should show nothing when the search matches nothing', () => {
    expect(describeTree('zzz', Filter.All)).toEqual([]);
  });
});
