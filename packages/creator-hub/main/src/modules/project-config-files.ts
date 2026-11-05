// Shared helpers for the agent config files the Hub writes into a scene folder (Claude Code's
// `.mcp.json`, Cursor's `.cursor/mcp.json`, Gemini's `.gemini/settings.json`) and for the
// `.gitignore` rules that keep machine-local files out of a creator's repo.
import fs from 'fs';
import path from 'path';

export function readJsonObject(file: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed))
      return parsed as Record<string, unknown>;
  } catch {
    /* no file yet, or invalid JSON — start fresh */
  }
  return {};
}

function serversOf(config: Record<string, unknown>): Record<string, unknown> {
  return config.mcpServers !== null && typeof config.mcpServers === 'object'
    ? (config.mcpServers as Record<string, unknown>)
    : {};
}

// Make sure `<dir>/.gitignore` covers `entry` (as `entry`, `/entry` or `entry/`, or any of
// `coveredBy`). Idempotent: appends only when nothing already ignores it, and never rewrites
// what the creator wrote. `comment` goes on its own line above the rule.
export function ensureGitignored(
  dir: string,
  entry: string,
  opts: { coveredBy?: string[]; comment?: string } = {},
): void {
  const gitignore = path.join(dir, '.gitignore');
  let content = '';
  try {
    content = fs.readFileSync(gitignore, 'utf8');
  } catch {
    /* no .gitignore yet — created below */
  }
  const patterns = [entry, `/${entry}`, `${entry}/`, ...(opts.coveredBy ?? [])];
  const covered = content.split(/\r?\n/).some(l => patterns.includes(l.trim()));
  if (covered) return;
  const head = content === '' || content.endsWith('\n') ? content : `${content}\n`;
  const comment = opts.comment !== undefined ? `\n# ${opts.comment}\n` : '';
  fs.writeFileSync(gitignore, `${head}${comment}${entry}\n`);
}

// Add or replace one server under `mcpServers` in an agent's JSON config, keeping the user's
// own servers and keys. `mode` applies only when the file is created; an existing file keeps
// its permissions.
export function upsertMcpServer(
  file: string,
  name: string,
  server: Record<string, unknown>,
  opts: { mode?: number } = {},
): void {
  const config = readJsonObject(file);
  config.mcpServers = { ...serversOf(config), [name]: server };
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`, { mode: opts.mode });
}
