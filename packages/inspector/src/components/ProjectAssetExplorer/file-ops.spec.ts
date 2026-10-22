import {
  collectAssetReferences,
  createPathMapper,
  getBaseName,
  getRange,
  getParentPath,
  getUniqueCopyName,
  isOutsideAssets,
  namesBelow,
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
      expect(validateName('tree.glb', ['Tree.glb', 'b.glb'], 'Tree.glb')).toBeUndefined();
      expect(validateName('B.glb', ['Tree.glb', 'b.glb'], 'Tree.glb')).toBeDefined();
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
    it('should ignore letter case, as the explorer does', () => {
      expect(map('A/B/x.glb')).toBe('a/c/x.glb');
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
    it('should treat backslashes as separators', () => {
      expect(normalizePath('Models/..\\..\\.env')).toBe('../.env');
      expect(normalizePath('Models\\tex\\t.png')).toBe('Models/tex/t.png');
    });
  });

  describe('isOutsideAssets', () => {
    it('should flag normalized paths that climb above the assets folder', () => {
      expect(isOutsideAssets('')).toBe(true);
      expect(isOutsideAssets('..')).toBe(true);
      expect(isOutsideAssets('../.env')).toBe(true);
      expect(isOutsideAssets('models/tree.bin')).toBe(false);
      expect(isOutsideAssets('..hidden/tree.bin')).toBe(false);
    });
    it('should flag drive-qualified paths', () => {
      expect(isOutsideAssets('C:/Users/me/.env')).toBe(true);
      expect(isOutsideAssets('models/c:t.png')).toBe(true);
    });
  });

  describe('namesBelow', () => {
    it('should list the names the written paths take directly inside a folder', () => {
      expect(
        namesBelow('b', ['b/m.gltf', 'b/t.png', 'b/textures/w.png', 'bb/x.png', 'c/t.png']),
      ).toEqual(['m.gltf', 't.png', 'textures']);
      expect(namesBelow('', ['m.gltf', 'textures/w.png'])).toEqual(['m.gltf', 'textures']);
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

  describe('Script parameters', () => {
    const script = {
      value: [
        {
          path: 'assets/chest/Chest.ts',
          priority: 0,
          layout: JSON.stringify({
            params: {
              openSound: { type: 'string', optional: true, value: 'open.mp3' },
              closeSound: { type: 'string', value: 'sounds/close.mp3' },
              hoverText: { type: 'string', value: 'Open // Close' },
              url: { type: 'string', value: 'https://discord.com' },
              idleAnimation: { type: 'string', value: '' },
              speed: { type: 'number', value: 2 },
            },
            actions: [{ methodName: 'open', params: {} }],
          }),
        },
      ],
    };
    const paramsOf = (value: typeof script) => JSON.parse(value.value[0].layout).params;

    describe('when a file a string parameter names is renamed in place', () => {
      it('should write the new name and leave the other parameters untouched', () => {
        const next = replaceAssetReferences(
          script,
          createPathMapper('assets/chest/open.mp3', 'assets/chest/open12345.mp3'),
        );
        expect(paramsOf(next)).toEqual({
          ...paramsOf(script),
          openSound: { type: 'string', optional: true, value: 'open12345.mp3' },
        });
      });
    });

    describe('when the file moves to a subfolder of the script', () => {
      it('should write the path relative to the script folder', () => {
        const next = replaceAssetReferences(
          script,
          createPathMapper('assets/chest/sounds', 'assets/chest/audio'),
        );
        expect(paramsOf(next).closeSound.value).toBe('audio/close.mp3');
      });
    });

    describe('when the file moves outside the script folder', () => {
      let unreachable: string[];
      let next: typeof script;

      beforeEach(() => {
        unreachable = [];
        next = replaceAssetReferences(
          script,
          createPathMapper('assets/chest/open.mp3', 'assets/sfx/open.mp3'),
          path => unreachable.push(path),
        );
      });

      it('should keep the parameter, since the script only reads files inside its folder', () => {
        expect(next).toBe(script);
      });

      it('should report the file the parameter can no longer point at', () => {
        expect(unreachable).toEqual(['assets/sfx/open.mp3']);
      });
    });

    describe('when the parameter names the file with different letter case', () => {
      it('should follow the rename, as the explorer looks files up ignoring case', () => {
        const next = replaceAssetReferences(
          script,
          createPathMapper('assets/chest/OPEN.MP3', 'assets/chest/open2.mp3'),
        );
        expect(paramsOf(next).openSound.value).toBe('open2.mp3');
      });
    });

    describe('when the script sits at the root', () => {
      it('should write the new name without climbing out', () => {
        const rootScript = {
          value: [
            {
              path: 'Chest.ts',
              layout: JSON.stringify({ params: { sound: { type: 'string', value: 'open.mp3' } } }),
            },
          ],
        };
        const next = replaceAssetReferences(rootScript, createPathMapper('open.mp3', 'open2.mp3'));
        expect(JSON.parse(next.value[0].layout).params.sound.value).toBe('open2.mp3');
      });
    });

    describe('when the whole smart item folder is renamed', () => {
      it('should move the script path and keep the names relative to it', () => {
        const next = replaceAssetReferences(script, createPathMapper('assets/chest', 'assets/box'));
        expect(next.value[0].path).toBe('assets/box/Chest.ts');
        expect(paramsOf(next)).toEqual(paramsOf(script));
      });
    });

    describe('when no parameter names the renamed file', () => {
      it('should keep the same reference', () => {
        expect(
          replaceAssetReferences(script, createPathMapper('assets/chest/x.mp3', 'assets/y.mp3')),
        ).toBe(script);
      });
    });

    describe('when collecting the files a script uses', () => {
      it('should include the files its string parameters name', () => {
        expect(collectAssetReferences(script)).toEqual(
          expect.arrayContaining(['assets/chest/open.mp3', 'assets/chest/sounds/close.mp3']),
        );
      });
    });
  });
});
