import { describe, expect, it } from 'vitest';
import { tutorials } from './tutorials';

describe('when reading the shared tutorials list', () => {
  it('should not be empty', () => {
    expect(tutorials.length).toBeGreaterThan(0);
  });

  it('should have unique video ids', () => {
    const ids = tutorials.map(video => video.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('should have a non-empty id, title and list on every video', () => {
    for (const video of tutorials) {
      expect(video.id).not.toBe('');
      expect(video.title).not.toBe('');
      expect(video.list).not.toBe('');
    }
  });
});
