import { describe, expect, it } from 'vitest';

import type { RootState } from '../store';
import reducer, { getSceneRunStarted, initialState, setSceneRunIntent } from './index';

const started = (state: typeof initialState) => getSceneRunStarted({ ui: state } as RootState);

describe('scene run intent', () => {
  describe('when the scene has never run', () => {
    it('should report it as not started', () => {
      expect(started(initialState)).toBe(false);
    });
  });

  describe('when the scene is run', () => {
    it('should mark it as started', () => {
      const state = reducer(initialState, setSceneRunIntent({ running: true }));
      expect(started(state)).toBe(true);
      expect(state.sceneRunIntent).toBe(true);
    });
  });

  describe('when a running scene is paused', () => {
    it('should keep it started', () => {
      const running = reducer(initialState, setSceneRunIntent({ running: true }));
      const state = reducer(running, setSceneRunIntent({ running: false }));
      expect(started(state)).toBe(true);
      expect(state.sceneRunIntent).toBe(false);
    });
  });

  describe('when the scene is stopped', () => {
    it('should clear the started flag', () => {
      const running = reducer(initialState, setSceneRunIntent({ running: true }));
      const state = reducer(running, setSceneRunIntent({ running: false, reset: true }));
      expect(started(state)).toBe(false);
      expect(state.sceneRunIntent).toBe(false);
    });
  });
});
