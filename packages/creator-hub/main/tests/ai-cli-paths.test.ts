import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The managed-CLI paths/state module reads/writes under getUserDataPath(); point that at a
// throwaway temp dir so the tests exercise real fs without touching the user's data.
const TEMP = path.join(os.tmpdir(), 'ch-ai-cli-paths-test');
vi.mock('../src/modules/electron', () => ({ getUserDataPath: () => TEMP }));

import {
  getCliState,
  getManagedBinDir,
  isInstalled,
  isSignedIn,
  setSignedIn,
} from '../src/modules/ai-cli-paths';

function makeInstalled(bin: string) {
  const dir = getManagedBinDir();
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, bin), '#!/bin/sh\n');
}

beforeEach(() => {
  fs.rmSync(TEMP, { recursive: true, force: true });
});
afterEach(() => {
  fs.rmSync(TEMP, { recursive: true, force: true });
});

describe('ai-cli-paths', () => {
  it('reports nothing installed or signed in on a clean profile', () => {
    expect(isInstalled('claude')).toBe(false);
    expect(isSignedIn('claude')).toBe(false);
    expect(getCliState()).toEqual({
      claude: { installed: false, signedIn: false },
      codex: { installed: false, signedIn: false },
    });
  });

  it('detects an installed binary in the managed bin dir', () => {
    makeInstalled('claude');
    expect(isInstalled('claude')).toBe(true);
    expect(isInstalled('codex')).toBe(false);
  });

  it('gates signed-in on being installed AND the persisted marker', () => {
    // Marker without an install must not read as signed in.
    setSignedIn('claude', true);
    expect(isSignedIn('claude')).toBe(false);
    // Once the binary exists too, the marker counts.
    makeInstalled('claude');
    expect(isSignedIn('claude')).toBe(true);
  });

  it('clears the marker on sign-out', () => {
    makeInstalled('claude');
    setSignedIn('claude', true);
    expect(isSignedIn('claude')).toBe(true);
    setSignedIn('claude', false);
    expect(isSignedIn('claude')).toBe(false);
  });

  it('keeps providers independent in getCliState', () => {
    makeInstalled('codex');
    setSignedIn('codex', true);
    expect(getCliState()).toEqual({
      claude: { installed: false, signedIn: false },
      codex: { installed: true, signedIn: true },
    });
  });
});
