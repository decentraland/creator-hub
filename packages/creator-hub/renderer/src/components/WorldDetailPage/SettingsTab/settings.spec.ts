import { describe, expect, it } from 'vitest';

import { formatTime, parseTime, settingsChanges, settingsValid, toSettingsDraft } from './settings';

const saved = {
  spawnCoordinates: '3,-4',
  skyboxTime: null,
  singlePlayer: false,
  showInPlaces: true,
};

describe('toSettingsDraft', () => {
  it('should split the spawn coordinate and keep Auto as null', () => {
    expect(toSettingsDraft(saved)).toEqual({
      x: '3',
      y: '-4',
      skyboxTime: null,
      singlePlayer: false,
      showInPlaces: true,
    });
  });

  it('should show a saved midnight as 00:00', () => {
    expect(toSettingsDraft({ skyboxTime: 86400 }).skyboxTime).toBe(0);
  });
});

describe('settingsChanges', () => {
  it('should be empty when nothing changed', () => {
    expect(settingsChanges(toSettingsDraft(saved), saved)).toEqual({});
  });

  it('should send only what changed, the spawn as "x,y" and midnight as 86400', () => {
    const draft = { ...toSettingsDraft(saved), x: '10', skyboxTime: 0, singlePlayer: true };

    expect(settingsChanges(draft, saved)).toEqual({
      spawnCoordinates: '10,-4',
      skyboxTime: 86400,
      singlePlayer: true,
    });
  });

  it('should send Auto as null', () => {
    const draft = { ...toSettingsDraft({ ...saved, skyboxTime: 14400 }), skyboxTime: null };

    expect(settingsChanges(draft, { ...saved, skyboxTime: 14400 })).toEqual({ skyboxTime: null });
  });
});

describe('settingsValid', () => {
  it('should accept whole coordinates inside the World bounds', () => {
    expect(settingsValid({ ...toSettingsDraft(saved), x: '-150', y: '150' })).toBe(true);
  });

  it('should accept a World with no spawn set, both coordinates empty', () => {
    expect(settingsValid({ ...toSettingsDraft({}), singlePlayer: true })).toBe(true);
  });

  it('should reject a coordinate that is empty, fractional or out of bounds', () => {
    expect(settingsValid({ ...toSettingsDraft(saved), x: '' })).toBe(false);
    expect(settingsValid({ ...toSettingsDraft(saved), x: '1.5' })).toBe(false);
    expect(settingsValid({ ...toSettingsDraft(saved), y: '151' })).toBe(false);
  });
});

describe('formatTime and parseTime', () => {
  it('should turn seconds into HH:MM and back', () => {
    expect(formatTime(14400)).toBe('04:00');
    expect(parseTime('04:00')).toBe(14400);
    expect(parseTime('23:59')).toBe(86340);
  });

  it('should reject a time that is not HH:MM within the day', () => {
    expect(parseTime('4')).toBeNull();
    expect(parseTime('24:00')).toBeNull();
    expect(parseTime('12:60')).toBeNull();
  });
});
