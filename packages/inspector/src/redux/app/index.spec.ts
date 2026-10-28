import { appState, upsertThumbnail, updateThumbnails } from './index';

const thumbnail = (path: string, byte: number) => ({ path, content: new Uint8Array([byte]) });

describe('redux/app', () => {
  describe('upsertThumbnail', () => {
    it('should add a new thumbnail and replace an existing one in place', () => {
      const loaded = appState.reducer(
        undefined,
        updateThumbnails({
          files: [thumbnail('thumbnails/a.png', 1), thumbnail('thumbnails/b.png', 2)],
        }),
      );
      const replaced = appState.reducer(loaded, upsertThumbnail(thumbnail('thumbnails/a.png', 9)));
      const added = appState.reducer(replaced, upsertThumbnail(thumbnail('thumbnails/c.png', 3)));
      expect(added.thumbnails.map($ => [$.path, $.content[0]])).toEqual([
        ['thumbnails/a.png', 9],
        ['thumbnails/b.png', 2],
        ['thumbnails/c.png', 3],
      ]);
    });
  });
});
