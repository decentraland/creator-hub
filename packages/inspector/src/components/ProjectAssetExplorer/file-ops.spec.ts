import {
  createPathMapper,
  getBaseName,
  getRange,
  getParentPath,
  getUniqueCopyName,
  pruneNestedPaths,
  replaceAssetReferences,
  splitName,
  validateName,
} from './file-ops';

describe('ProjectAssetExplorer/file-ops', () => {
  describe('paths', () => {
    it('should split base name and parent', () => {
      expect(getBaseName('a/b/c.glb')).toBe('c.glb');
      expect(getBaseName('c.glb')).toBe('c.glb');
      expect(getParentPath('a/b/c.glb')).toBe('a/b');
      expect(getParentPath('c.glb')).toBe('');
    });
    it('should split extension', () => {
      expect(splitName('model.final.glb')).toEqual({ base: 'model.final', ext: '.glb' });
      expect(splitName('.hidden')).toEqual({ base: '.hidden', ext: '' });
      expect(splitName('my.folder', true)).toEqual({ base: 'my.folder', ext: '' });
    });
  });

  describe('validateName', () => {
    it('should reject empty, invalid and duplicated names', () => {
      expect(validateName('  ', [])).toBeDefined();
      expect(validateName('a/b', [])).toBeDefined();
      expect(validateName('..', [])).toBeDefined();
      expect(validateName('A.glb', ['a.glb'])).toBeDefined();
    });
    it('should accept the current name and free names', () => {
      expect(validateName('a.glb', ['a.glb'], 'a.glb')).toBeUndefined();
      expect(validateName('b.glb', ['a.glb'], 'a.glb')).toBeUndefined();
    });
  });

  describe('getUniqueCopyName', () => {
    it('should append "copy" before the extension', () => {
      expect(getUniqueCopyName('model.glb', ['model.glb'])).toBe('model copy.glb');
    });
    it('should increment when copies already exist', () => {
      expect(getUniqueCopyName('model.glb', ['model.glb', 'model copy.glb'])).toBe(
        'model copy 2.glb',
      );
    });
    it('should not treat folder names as having an extension', () => {
      expect(getUniqueCopyName('v1.2', ['v1.2'], true)).toBe('v1.2 copy');
    });
  });

  describe('createPathMapper', () => {
    const map = createPathMapper('a/b', 'a/c');
    it('should map the node itself and its descendants', () => {
      expect(map('a/b')).toBe('a/c');
      expect(map('a/b/x/y.glb')).toBe('a/c/x/y.glb');
    });
    it('should ignore unrelated paths, including prefix siblings', () => {
      expect(map('a/bb/y.glb')).toBeUndefined();
      expect(map('z')).toBeUndefined();
    });
  });

  describe('replaceAssetReferences', () => {
    const map = createPathMapper('assets/old.glb', 'assets/new.glb');
    it('should replace nested path fields', () => {
      const value = {
        tex: { texture: { src: 'assets/old.glb' } },
        list: [{ path: 'assets/old.glb' }],
      };
      expect(replaceAssetReferences(value, map)).toEqual({
        tex: { texture: { src: 'assets/new.glb' } },
        list: [{ path: 'assets/new.glb' }],
      });
    });
    it('should keep the same reference when nothing changes', () => {
      const value = { src: 'assets/other.glb', visible: true };
      expect(replaceAssetReferences(value, map)).toBe(value);
    });
  });

  describe('pruneNestedPaths', () => {
    it('should drop paths covered by a selected ancestor and duplicates', () => {
      expect(pruneNestedPaths(['a', 'a/b.glb', 'ab/c.glb', 'a', 'd/e'])).toEqual([
        'a',
        'ab/c.glb',
        'd/e',
      ]);
    });
  });

  describe('getRange', () => {
    const ordered = ['a', 'b', 'c', 'd'];
    it('should return the items between both ends in display order', () => {
      expect(getRange(ordered, 'd', 'b')).toEqual(['b', 'c', 'd']);
      expect(getRange(ordered, 'a', 'c')).toEqual(['a', 'b', 'c']);
    });
    it('should fall back to the clicked item when the anchor is not visible', () => {
      expect(getRange(ordered, 'z', 'c')).toEqual(['c']);
      expect(getRange(ordered, 'a', 'z')).toEqual([]);
    });
  });
});
