import {
  collectAssetReferences,
  createPathMapper,
  getBaseName,
  getGltfResourceUris,
  getRange,
  getParentPath,
  getUniqueCopyName,
  isProtectedPath,
  normalizePath,
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

  describe('isProtectedPath', () => {
    it('should protect the scene folder and everything inside it', () => {
      expect(isProtectedPath('scene')).toBe(true);
      expect(isProtectedPath('scene/main.composite')).toBe(true);
      expect(isProtectedPath('scenery')).toBe(false);
      expect(isProtectedPath('Models/scene/a.glb')).toBe(false);
    });
  });

  describe('normalizePath', () => {
    it('should resolve dot segments and keep the ones that escape', () => {
      expect(normalizePath('Models/./a/../b.bin')).toBe('Models/b.bin');
      expect(normalizePath('Models/../textures/t.png')).toBe('textures/t.png');
      expect(normalizePath('Models/../../t.png')).toBe('../t.png');
      expect(normalizePath('a//b')).toBe('a/b');
    });
  });

  describe('getGltfResourceUris', () => {
    const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));
    it('should list relative buffer and image uris, decoded', () => {
      const content = encode({
        buffers: [{ uri: 'model.bin' }, { uri: 'data:application/octet-stream;base64,AAA' }],
        images: [{ uri: '../textures/my%20tex.png' }, { uri: 'https://cdn/x.png' }, {}],
      });
      expect(getGltfResourceUris(content)).toEqual(['model.bin', '../textures/my tex.png']);
    });
    it('should return nothing for binary or invalid content', () => {
      expect(getGltfResourceUris(new Uint8Array([0x67, 0x6c, 0x54, 0x46]))).toEqual([]);
      expect(getGltfResourceUris(encode({ asset: {} }))).toEqual([]);
    });
  });

  describe('Actions payloads', () => {
    const map = createPathMapper('assets/old', 'assets/new');
    const actions = {
      value: [
        { name: 'play', type: 'play_sound', jsonPayload: '{"src":"assets/old/a.mp3","loop":true}' },
        {
          name: 'call',
          type: 'call_script_method',
          jsonPayload: '{"scriptPath":"assets/old/s.ts","methodName":"go"}',
        },
        { name: 'stream', type: 'play_audio_stream', jsonPayload: '{"url":"https://radio/x"}' },
        { name: 'broken', type: 'show_image', jsonPayload: '{not json' },
      ],
    };

    it('should rewrite the paths inside jsonPayload and leave the rest untouched', () => {
      const next = replaceAssetReferences(actions, map);
      expect(next).not.toBe(actions);
      expect(JSON.parse(next.value[0].jsonPayload)).toEqual({
        src: 'assets/new/a.mp3',
        loop: true,
      });
      expect(JSON.parse(next.value[1].jsonPayload)).toEqual({
        scriptPath: 'assets/new/s.ts',
        methodName: 'go',
      });
      expect(next.value[2]).toBe(actions.value[2]);
      expect(next.value[3]).toBe(actions.value[3]);
    });

    it('should keep the same reference when no payload points at the renamed path', () => {
      expect(replaceAssetReferences(actions, createPathMapper('assets/x', 'assets/y'))).toBe(
        actions,
      );
    });

    it('should collect the paths referenced through payloads and plain fields', () => {
      expect(collectAssetReferences(actions)).toEqual(['assets/old/a.mp3', 'assets/old/s.ts']);
      const material = {
        material: {
          $case: 'pbr',
          pbr: { texture: { tex: { $case: 'texture', texture: { src: 'assets/t.png' } } } },
        },
      };
      expect(collectAssetReferences(material)).toEqual(['assets/t.png']);
      expect(collectAssetReferences({ value: [{ path: 'assets/s.ts' }] })).toEqual(['assets/s.ts']);
    });
  });
});
