import { isMissingScriptFile, resolveScriptFile } from './script-files';

describe('script-files', () => {
  const scriptPath = 'assets/chest/Chest.ts';

  describe('resolveScriptFile', () => {
    describe('when the value is a file name', () => {
      it('should resolve it against the script folder', () => {
        expect(resolveScriptFile(scriptPath, 'open.mp3')).toBe('assets/chest/open.mp3');
      });
    });

    describe('when the value names a file in a subfolder', () => {
      it('should resolve it below the script folder', () => {
        expect(resolveScriptFile(scriptPath, 'sounds/close.mp3')).toBe(
          'assets/chest/sounds/close.mp3',
        );
      });
    });

    describe('when the value is a url', () => {
      it('should not treat it as a file', () => {
        expect(resolveScriptFile(scriptPath, 'https://discord.com')).toBeUndefined();
      });
    });

    describe('when the value is text that is not a clean path', () => {
      it('should not treat it as a file', () => {
        expect(resolveScriptFile(scriptPath, 'Open // Close')).toBeUndefined();
      });
    });

    describe('when the value is empty', () => {
      it('should not treat it as a file', () => {
        expect(resolveScriptFile(scriptPath, '')).toBeUndefined();
      });
    });
  });

  describe('isMissingScriptFile', () => {
    let files: Set<string>;

    beforeEach(() => {
      files = new Set(['assets/chest/open.mp3', 'assets/chest/chest.ts']);
    });

    describe('when the file is in the scene', () => {
      it('should not report it, ignoring letter case as the explorer does', () => {
        expect(isMissingScriptFile(scriptPath, 'Open.MP3', files)).toBe(false);
      });
    });

    describe('when an audio file is not in the scene', () => {
      it('should report it', () => {
        expect(isMissingScriptFile(scriptPath, 'close.mp3', files)).toBe(true);
      });
    });

    describe('when the value has no asset extension', () => {
      it('should not report it, since it is plain text', () => {
        expect(isMissingScriptFile(scriptPath, 'Open / Close', files)).toBe(false);
      });
    });

    describe('when the value is a url to an asset', () => {
      it('should not report it', () => {
        expect(isMissingScriptFile(scriptPath, 'https://cdn.example.com/open.mp3', files)).toBe(
          false,
        );
      });
    });
  });
});
