import { getRelativeResourcePath, getResourcesBasePath } from './path-utils';

describe('path-utils', () => {
  describe('getResourcesBasePath', () => {
    it('should return the common directory prefix for multiple resources in subfolders', () => {
      const resources = [
        'scene/assets/pack/subfolder/model.glb',
        'scene/assets/pack/subfolder/texture.png',
      ];
      expect(getResourcesBasePath(resources)).toBe('scene/assets/pack/subfolder');
    });

    it('should return the common directory prefix for resources in different subfolders', () => {
      const resources = ['scene/assets/pack/sub1/model.glb', 'scene/assets/pack/sub2/texture.png'];
      expect(getResourcesBasePath(resources)).toBe('scene/assets/pack');
    });

    it('should return the parent directory for a single file', () => {
      const resources = ['scene/assets/pack/model.glb'];
      expect(getResourcesBasePath(resources)).toBe('scene/assets/pack');
    });

    it('should return empty string for empty array', () => {
      expect(getResourcesBasePath([])).toBe('');
    });
  });

  describe('getRelativeResourcePath', () => {
    it('should return relative path when file is under base', () => {
      expect(
        getRelativeResourcePath('scene/assets/pack/subfolder/model.glb', 'scene/assets/pack'),
      ).toBe('subfolder/model.glb');
    });

    it('should return filename only when file is in base directory', () => {
      expect(getRelativeResourcePath('scene/assets/pack/model.glb', 'scene/assets/pack')).toBe(
        'model.glb',
      );
    });

    it('should return filename when path is not under base', () => {
      expect(getRelativeResourcePath('other/path/model.glb', 'scene/assets/pack')).toBe(
        'model.glb',
      );
    });

    it('should return filename when base is empty', () => {
      expect(getRelativeResourcePath('scene/assets/pack/model.glb', '')).toBe('model.glb');
    });
  });
});
