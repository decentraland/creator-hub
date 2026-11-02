import { describe, it, expect } from 'vitest';

import { MIN_CLAUDE_CLI_VERSION, cliSetup, isCliVersionOutdated } from '../types/ai';

describe('isCliVersionOutdated', () => {
  const MIN = MIN_CLAUDE_CLI_VERSION;

  it('flags a version below the floor (the 2.1.39 screenshot case)', () => {
    expect(isCliVersionOutdated('2.1.39', MIN)).toBe(true);
  });

  it('accepts the floor and anything newer', () => {
    expect(isCliVersionOutdated('2.1.251', MIN)).toBe(false);
    expect(isCliVersionOutdated('2.1.260', MIN)).toBe(false);
    expect(isCliVersionOutdated('3.0.0', MIN)).toBe(false);
  });

  it('compares each segment numerically, not lexicographically', () => {
    // "39" < "251" as numbers; a string compare would wrongly rank "39" > "251".
    expect(isCliVersionOutdated('2.1.39', '2.1.251')).toBe(true);
    expect(isCliVersionOutdated('2.0.999', '2.1.0')).toBe(true);
  });

  it('never nags when the version is unknown or unparseable', () => {
    expect(isCliVersionOutdated(undefined, MIN)).toBe(false);
    expect(isCliVersionOutdated('garbage', MIN)).toBe(false);
  });

  it('tolerates trailing text around the semver (e.g. "2.1.260 (Claude Code)")', () => {
    expect(isCliVersionOutdated('2.1.39 (Claude Code)', MIN)).toBe(true);
    expect(isCliVersionOutdated('2.1.260 (Claude Code)', MIN)).toBe(false);
  });
});

describe('when picking the terminal setup steps for an agent', () => {
  it('should give Windows users the winget install and the Windows section of the guide', () => {
    expect(cliSetup('claude', true)).toMatchObject({
      install: 'winget install Anthropic.ClaudeCode',
      signin: 'claude auth login',
      guideUrl: 'https://code.claude.com/docs/en/terminal-guide#windows',
    });
  });

  it('should give macOS and Linux users the install script and their section of the guide', () => {
    expect(cliSetup('claude', false)).toMatchObject({
      install: 'curl -fsSL https://claude.ai/install.sh | bash',
      signin: 'claude auth login',
      guideUrl: 'https://code.claude.com/docs/en/terminal-guide#macos-and-linux',
    });
  });

  it('should use the same command and guide on every OS when the vendor has only one', () => {
    expect(cliSetup('gemini', true)).toEqual(cliSetup('gemini', false));
  });

  it('should never point Cursor users at the unrelated cursor-agent npm package', () => {
    for (const windows of [true, false]) {
      expect(cliSetup('cursor', windows).install).not.toContain('npm');
    }
  });
});
