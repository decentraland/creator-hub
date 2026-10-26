import { cleanAssetsSlice, dropRestoredFiles, setRemovedFiles } from './index';

const file = (path: string) => ({ path, content: new Uint8Array([1]) });

describe('redux/clean-assets', () => {
  describe('dropRestoredFiles', () => {
    it('should forget the removed files that exist again', () => {
      const removed = cleanAssetsSlice.reducer(
        undefined,
        setRemovedFiles([file('assets/a.glb'), file('assets/a.bin'), file('assets/b.png')]),
      );
      const next = cleanAssetsSlice.reducer(
        removed,
        dropRestoredFiles(['assets/a.glb', 'assets/a.bin', 'assets/other.png']),
      );
      expect(next.removedFiles.map($ => $.path)).toEqual(['assets/b.png']);
    });
  });
});
