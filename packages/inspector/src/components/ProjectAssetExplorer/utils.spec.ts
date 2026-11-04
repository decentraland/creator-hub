import { Filter } from './Filters/types';
import * as utils from './utils';

import type { AssetNodeFolder, AssetNodeItem } from './types';

describe('ProjectAssetExplorer/utils', () => {
  describe('getFullNodePath', () => {
    it('should return full node path given a child', () => {
      const parentA = { name: 'parentA', parent: null };
      const parentB = { name: 'parentB', parent: parentA };
      const child = { name: 'file.gltf', parent: parentB } as AssetNodeItem;
      expect(utils.getFullNodePath(child)).toBe('/parentA/parentB/file.gltf');
    });
    it('should return child name if node has no parent', () => {
      const child = { name: 'file.gltf', parent: null } as AssetNodeItem;
      expect(utils.getFullNodePath(child)).toBe('/file.gltf');
    });
  });
  describe('isAssetNode', () => {
    it('should return true when node type "asset"', () => {
      const node: AssetNodeItem = {
        name: 'some-name',
        parent: null,
        type: 'asset',
        asset: {
          src: 'some-file.glb',
          type: 'gltf',
        },
      };
      expect(utils.isAssetNode(node)).toBe(true);
    });
    it('should return false when node type is different from "asset"', () => {
      const node: AssetNodeFolder = {
        name: 'some-name',
        parent: null,
        type: 'folder',
        children: [],
      };
      expect(utils.isAssetNode(node)).toBe(false);
    });
  });
  describe('mapAssetTypeToFilter', () => {
    describe('when a model file name ends in _emote', () => {
      it('should group it under Avatar Animations', () => {
        const asset = { type: 'gltf' as const, src: 'asset-packs/dance/Avatar_Dance_emote.glb' };
        expect(utils.mapAssetTypeToFilter(asset)).toBe(Filter.Emotes);
      });
    });

    describe('when a model file name does not end in _emote', () => {
      it('should group it under Models', () => {
        const asset = { type: 'gltf' as const, src: 'models/emote_stage.glb' };
        expect(utils.mapAssetTypeToFilter(asset)).toBe(Filter.Models);
      });
    });

    describe('when a non-model file name ends in _emote', () => {
      it('should not group it under Avatar Animations', () => {
        const asset = { type: 'image' as const, src: 'images/wave_emote.png' };
        expect(utils.mapAssetTypeToFilter(asset)).toBe(Filter.Images);
      });
    });
  });
});
