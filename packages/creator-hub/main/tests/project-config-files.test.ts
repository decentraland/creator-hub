import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ensureGitignored, upsertMcpServer } from '../src/modules/project-config-files';

let dir: string;
const gitignore = () => fs.readFileSync(path.join(dir, '.gitignore'), 'utf8');

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ch-project-config-'));
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('ensureGitignored', () => {
  describe('when an existing rule already covers the entry', () => {
    it.each(['skills', '/skills', 'skills/'])('should leave "%s" as the only rule', rule => {
      fs.writeFileSync(path.join(dir, '.gitignore'), `${rule}\r\n`);

      ensureGitignored(dir, 'skills');

      expect(gitignore()).toBe(`${rule}\r\n`);
    });

    it('should accept a broader rule the caller names', () => {
      fs.writeFileSync(path.join(dir, '.gitignore'), '.cursor/\n');

      ensureGitignored(dir, '.cursor/mcp.json', { coveredBy: ['.cursor', '.cursor/'] });

      expect(gitignore()).toBe('.cursor/\n');
    });
  });

  describe('when nothing covers the entry', () => {
    it('should append it on its own line, under the comment when one is given', () => {
      fs.writeFileSync(path.join(dir, '.gitignore'), 'node_modules');

      ensureGitignored(dir, '.mcp.json', { comment: 'local token' });

      expect(gitignore()).toBe('node_modules\n\n# local token\n.mcp.json\n');
    });
  });
});

describe('upsertMcpServer', () => {
  const file = () => path.join(dir, 'sub', 'mcp.json');
  const read = () => JSON.parse(fs.readFileSync(file(), 'utf8'));

  it('should add ours beside the user’s servers', () => {
    fs.mkdirSync(path.dirname(file()));
    fs.writeFileSync(file(), JSON.stringify({ mcpServers: { mine: { command: 'x' } } }));

    upsertMcpServer(file(), 'creator-hub', { url: 'u' });

    expect(read().mcpServers).toEqual({ mine: { command: 'x' }, 'creator-hub': { url: 'u' } });
  });

  it('should create the file with the given mode', () => {
    upsertMcpServer(file(), 'creator-hub', { url: 'u' }, { mode: 0o600 });

    expect(fs.statSync(file()).mode & 0o777).toBe(0o600);
  });
});
