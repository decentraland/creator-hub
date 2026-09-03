import { describe, expect, it, vi } from 'vitest';

// ai.ts → scene-mcp → explorer-gateway → cli → path.ts calls electron `app.getAppPath()` at
// import. This suite only tests pure parseLine/PATH helpers, so stub the gateway to keep the
// module graph node-loadable without an Electron app.
// analytics pulls @sentry/electron/main → electron (named `app` import) which won't load in
// the node test env. This suite tests pure parser/PATH/buildArgs helpers, so stub it out.
vi.mock('../src/modules/analytics', () => ({
  track: vi.fn(),
  getProjectId: vi.fn(async () => 'test-project-id'),
}));
vi.mock('../src/modules/explorer-gateway', () => ({
  callExplorerTool: vi.fn(),
  explorerTools: () => [],
  onExplorerToolsChanged: () => () => {},
  gatewayProject: () => null,
  launchPreview: vi.fn(),
  previewStatus: vi.fn(),
  stopExplorerGateway: vi.fn(),
  stopPreview: vi.fn(),
}));

import { PROVIDERS, filterEnvForChild, nvmBinDirs, parseShellPath } from '../src/modules/ai';

const PROJECT = '/home/user/scene';

// Collect what a provider's parseLine emits, so a CLI output-format change is caught by
// something instead of silently dropping text or tool chips.
function run(provider: 'claude' | 'codex', line: string) {
  const texts: string[] = [];
  const tools: Array<[string, string]> = [];
  const images: string[] = [];
  const session = PROVIDERS[provider].parseLine(line, PROJECT, (text, tool, image) => {
    if (text !== '') texts.push(text);
    if (tool !== undefined) tools.push(tool);
    if (image !== undefined) images.push(image);
  });
  return { session, texts, tools, images };
}

describe('claude parseLine', () => {
  it('returns the session id from the init line without emitting', () => {
    const { session, texts, tools } = run(
      'claude',
      JSON.stringify({ type: 'system', subtype: 'init', session_id: 'sess-1' }),
    );
    expect(session).toBe('sess-1');
    expect(texts).toEqual([]);
    expect(tools).toEqual([]);
  });

  it('emits assistant text blocks', () => {
    const { texts } = run(
      'claude',
      JSON.stringify({
        type: 'assistant',
        message: { content: [{ type: 'text', text: 'Hello' }] },
      }),
    );
    expect(texts).toEqual(['Hello']);
  });

  it('emits a tool chip with a scene-relative file path', () => {
    const { tools } = run(
      'claude',
      JSON.stringify({
        type: 'assistant',
        message: {
          content: [
            { type: 'tool_use', name: 'Write', input: { file_path: `${PROJECT}/src/Door.ts` } },
          ],
        },
      }),
    );
    expect(tools).toEqual([['Write', 'src/Door.ts']]);
  });

  it('prefers a Bash description over the raw command', () => {
    const { tools } = run(
      'claude',
      JSON.stringify({
        type: 'assistant',
        message: {
          content: [
            {
              type: 'tool_use',
              name: 'Bash',
              input: { command: 'npm run build', description: 'Build the scene' },
            },
          ],
        },
      }),
    );
    expect(tools).toEqual([['Bash', 'Build the scene']]);
  });

  it('returns the session id from the result line', () => {
    const { session } = run('claude', JSON.stringify({ type: 'result', session_id: 'sess-2' }));
    expect(session).toBe('sess-2');
  });

  it('surfaces an MCP screenshot image from a tool_result', () => {
    const { images } = run(
      'claude',
      JSON.stringify({
        type: 'user',
        message: {
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'toolu_1',
              content: [
                { type: 'text', text: 'captured' },
                {
                  type: 'image',
                  source: { type: 'base64', media_type: 'image/png', data: 'AAAA' },
                },
              ],
            },
          ],
        },
      }),
    );
    expect(images).toEqual(['data:image/png;base64,AAAA']);
  });

  it('ignores non-JSON chatter', () => {
    const { session, texts, tools } = run('claude', 'not json at all');
    expect(session).toBeUndefined();
    expect(texts).toEqual([]);
    expect(tools).toEqual([]);
  });
});

describe('codex parseLine', () => {
  it('returns the thread id from thread.started', () => {
    const { session } = run('codex', JSON.stringify({ type: 'thread.started', thread_id: 'th-1' }));
    expect(session).toBe('th-1');
  });

  it('emits a completed agent message', () => {
    const { texts } = run(
      'codex',
      JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: 'Done' } }),
    );
    expect(texts).toEqual(['Done']);
  });

  it('emits an Edit chip per file change', () => {
    const { tools } = run(
      'codex',
      JSON.stringify({
        type: 'item.completed',
        item: {
          type: 'file_change',
          changes: [{ path: `${PROJECT}/src/a.ts` }, { path: `${PROJECT}/src/b.ts` }],
        },
      }),
    );
    expect(tools).toEqual([
      ['Edit', 'src/a.ts'],
      ['Edit', 'src/b.ts'],
    ]);
  });

  it('emits a Run chip for a command execution', () => {
    const { tools } = run(
      'codex',
      JSON.stringify({
        type: 'item.completed',
        item: { type: 'command_execution', command: 'ls -la' },
      }),
    );
    expect(tools).toEqual([['Run', 'ls -la']]);
  });

  it('emits an MCP tool-call chip in the same mcp__server__tool format claude uses', () => {
    const { tools } = run(
      'codex',
      JSON.stringify({
        type: 'item.completed',
        item: {
          id: 'x',
          type: 'mcp_tool_call',
          server: 'creator-hub',
          tool: 'create_entity',
          status: 'completed',
        },
      }),
    );
    expect(tools).toEqual([['mcp__creator-hub__create_entity', '']]);
  });

  it('surfaces an MCP screenshot image from a tool-call result', () => {
    const { images } = run(
      'codex',
      JSON.stringify({
        type: 'item.completed',
        item: {
          type: 'mcp_tool_call',
          server: 'creator-hub',
          tool: 'explorer_call',
          result: { content: [{ type: 'image', data: 'BBBB', mimeType: 'image/jpeg' }] },
        },
      }),
    );
    expect(images).toEqual(['data:image/jpeg;base64,BBBB']);
  });

  it('emits a WebSearch chip for a web_search item', () => {
    const { tools } = run(
      'codex',
      JSON.stringify({
        type: 'item.completed',
        item: { id: 'x', type: 'web_search', query: 'decentraland sdk docs' },
      }),
    );
    expect(tools).toEqual([['WebSearch', 'decentraland sdk docs']]);
  });

  it('ignores partial (non-completed) items', () => {
    const { texts, tools } = run(
      'codex',
      JSON.stringify({ type: 'item.started', item: { type: 'agent_message', text: 'partial' } }),
    );
    expect(texts).toEqual([]);
    expect(tools).toEqual([]);
  });

  it('surfaces a top-level error event as text (so a failed turn is never silent)', () => {
    const { texts } = run(
      'codex',
      JSON.stringify({ type: 'error', message: 'Reconnecting... 401 Unauthorized' }),
    );
    expect(texts).toEqual(['Reconnecting... 401 Unauthorized\n']);
  });

  it('surfaces a terminal error item as text', () => {
    const { texts } = run(
      'codex',
      JSON.stringify({ type: 'item.completed', item: { type: 'error', message: 'stream failed' } }),
    );
    expect(texts).toEqual(['stream failed\n']);
  });
});

describe('parseShellPath', () => {
  it('extracts the marker-delimited PATH split on colons', () => {
    expect(parseShellPath('banner\n<<</usr/bin:/opt/homebrew/bin>>>trailer')).toEqual([
      '/usr/bin',
      '/opt/homebrew/bin',
    ]);
  });

  it('returns an empty list when the marker is absent', () => {
    expect(parseShellPath('no marker here')).toEqual([]);
  });
});

describe('nvmBinDirs', () => {
  it('returns an empty list for a missing nvm root', () => {
    expect(nvmBinDirs('/definitely/not/a/real/nvm/root')).toEqual([]);
  });
});

// The env filter is the security boundary: force subscription billing by default, allow
// API-key billing when opted in, but ALWAYS drop endpoint/session overrides. (Fake values.)
describe('filterEnvForChild', () => {
  const base = {
    HOME: '/home/u',
    ANTHROPIC_API_KEY: 'sk-ant-example',
    ANTHROPIC_AUTH_TOKEN: 'tok-example',
    OPENAI_API_KEY: 'sk-openai-example',
    CODEX_API_KEY: 'cx-example',
    ANTHROPIC_BASE_URL: 'http://example.invalid',
    OPENAI_BASE_URL: 'http://example.invalid',
    CLAUDECODE: '1',
    CLAUDE_CODE_ENTRYPOINT: 'x',
  };

  it('default (subscription billing): strips API keys and endpoint/session overrides', () => {
    const env = filterEnvForChild(base, false);
    expect(env.HOME).toBe('/home/u');
    for (const k of [
      'ANTHROPIC_API_KEY',
      'ANTHROPIC_AUTH_TOKEN',
      'OPENAI_API_KEY',
      'CODEX_API_KEY',
      'ANTHROPIC_BASE_URL',
      'OPENAI_BASE_URL',
      'CLAUDECODE',
      'CLAUDE_CODE_ENTRYPOINT',
    ]) {
      expect(env[k]).toBeUndefined();
    }
  });

  it('API-key billing: keeps the API keys but STILL strips endpoint/session overrides', () => {
    const env = filterEnvForChild(base, true);
    expect(env.ANTHROPIC_API_KEY).toBe('sk-ant-example');
    expect(env.OPENAI_API_KEY).toBe('sk-openai-example');
    expect(env.ANTHROPIC_AUTH_TOKEN).toBe('tok-example');
    // security-critical: an inherited endpoint override could redirect the token, so it is
    // dropped regardless of billing mode.
    expect(env.ANTHROPIC_BASE_URL).toBeUndefined();
    expect(env.OPENAI_BASE_URL).toBeUndefined();
    expect(env.CLAUDECODE).toBeUndefined();
    expect(env.CLAUDE_CODE_ENTRYPOINT).toBeUndefined();
  });
});

// Both providers must receive the CH MCP server (scene + Explorer-gateway tools) — the
// point of Codex parity — each in its own format, and never leak the token via argv.
describe('buildArgs MCP wiring', () => {
  const MCP = { url: 'http://127.0.0.1:65000/mcp', token: 'secret-token-xyz' };
  const base = { text: 'hi', projectDir: PROJECT, images: [] as string[] };

  it('claude: passes --mcp-config a file path (token rides in the file, not argv)', () => {
    const args = PROVIDERS.claude.buildArgs({ ...base, mcp: MCP });
    const i = args.indexOf('--mcp-config');
    expect(i).toBeGreaterThan(-1);
    expect(typeof args[i + 1]).toBe('string');
    expect(args.join(' ')).not.toContain(MCP.token); // token is in the file, never on the command line
  });

  it('claude: no --mcp-config when the server is unavailable', () => {
    expect(PROVIDERS.claude.buildArgs({ ...base }).join(' ')).not.toContain('--mcp-config');
  });

  it('codex: defines the HTTP MCP server via -c overrides, token via env var not argv', () => {
    const args = PROVIDERS.codex.buildArgs({ ...base, mcp: MCP });
    expect(args).toContain(`mcp_servers.creator-hub.url="${MCP.url}"`);
    expect(args).toContain('mcp_servers.creator-hub.bearer_token_env_var="CREATOR_HUB_MCP_TOKEN"');
    expect(args.join(' ')).not.toContain(MCP.token); // token comes from the child env, never argv
  });

  it('codex: no mcp_servers override when the server is unavailable', () => {
    expect(PROVIDERS.codex.buildArgs({ ...base }).join(' ')).not.toContain('mcp_servers');
  });
});
