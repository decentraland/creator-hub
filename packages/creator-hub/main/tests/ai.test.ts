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

import type { AiProvider } from '/shared/types/ai';

import {
  PROVIDERS,
  filterEnvForChild,
  friendlyCliError,
  nvmBinDirs,
  parseShellPath,
} from '../src/modules/ai';

const PROJECT = '/home/user/scene';

// Collect what a provider's parseLine emits, so a CLI output-format change is caught by
// something instead of silently dropping text or tool chips.
function run(provider: AiProvider, line: string) {
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

describe('cursor parseLine', () => {
  it('captures the session id from system/init', () => {
    const { session } = run(
      'cursor',
      JSON.stringify({ type: 'system', subtype: 'init', session_id: 'c-1' }),
    );
    expect(session).toBe('c-1');
  });

  it('emits assistant text blocks', () => {
    const { texts } = run(
      'cursor',
      JSON.stringify({
        type: 'assistant',
        message: { role: 'assistant', content: [{ type: 'text', text: 'Hello' }] },
      }),
    );
    expect(texts).toEqual(['Hello']);
  });

  it('emits a tool chip on a started tool_call, mapping the tool name and file', () => {
    const { tools } = run(
      'cursor',
      JSON.stringify({
        type: 'tool_call',
        subtype: 'started',
        call_id: 'x',
        tool_call: { editToolCall: { args: { path: '/home/user/scene/src/index.ts' } } },
      }),
    );
    expect(tools).toEqual([['Edit', 'src/index.ts']]);
  });

  it('does not emit a chip for the completed half of the started/completed pair', () => {
    const { tools } = run(
      'cursor',
      JSON.stringify({
        type: 'tool_call',
        subtype: 'completed',
        call_id: 'x',
        tool_call: {
          editToolCall: { args: { path: '/home/user/scene/src/index.ts' }, result: {} },
        },
      }),
    );
    expect(tools).toEqual([]);
  });

  it('reads the session id from the terminal result without re-emitting its text', () => {
    const { session, texts } = run(
      'cursor',
      JSON.stringify({
        type: 'result',
        subtype: 'success',
        is_error: false,
        result: 'full text',
        session_id: 'c-2',
      }),
    );
    expect(session).toBe('c-2');
    expect(texts).toEqual([]); // the result text would duplicate the assistant events
  });

  it('ignores non-JSON chatter', () => {
    const { session, texts, tools } = run('cursor', 'not json at all');
    expect(session).toBeUndefined();
    expect(texts).toEqual([]);
    expect(tools).toEqual([]);
  });
});

describe('cursor buildArgs', () => {
  const base = { text: 'hi', projectDir: PROJECT, images: [] as string[] };

  it('runs print + stream-json + force, with the prompt as the trailing positional', () => {
    const { args, stdin } = PROVIDERS.cursor.buildArgs({ ...base });
    expect(args).toContain('-p');
    expect(args.join(' ')).toContain('--output-format stream-json');
    expect(args).toContain('-f');
    expect(args[args.length - 1]).toBe('hi'); // prompt is the last positional
    expect(stdin).toBeUndefined(); // cursor has no stdin prompt channel
  });

  it('adds --model only for a non-default model', () => {
    expect(PROVIDERS.cursor.buildArgs({ ...base }).args).not.toContain('--model');
    const { args } = PROVIDERS.cursor.buildArgs({ ...base, model: 'sonnet-4' });
    expect(args[args.indexOf('--model') + 1]).toBe('sonnet-4');
  });

  it('resumes a chat by id', () => {
    const { args } = PROVIDERS.cursor.buildArgs({ ...base, resume: 'chat-123' });
    expect(args[args.indexOf('--resume') + 1]).toBe('chat-123');
  });

  // Cursor's rules ride in a project rule file (writeCursorRules), never on argv — so even a big
  // prompt keeps argv to just the flags + the user's own text, no ~7KB blob (Windows cmd.exe cap).
  it('keeps the DCL rules off argv', () => {
    const TOKEN = 'ZZ_USER_PROMPT_ZZ';
    const joined = PROVIDERS.cursor.buildArgs({ ...base, text: TOKEN }).args.join(' ');
    expect(joined).toContain(TOKEN); // the user prompt is on argv (cursor has no stdin)
    expect(joined.replace(TOKEN, '').length).toBeLessThan(100); // nothing else large inlined
  });
});

describe('gemini parseLine', () => {
  it('captures the session id from init', () => {
    const { session } = run(
      'gemini',
      JSON.stringify({ type: 'init', session_id: 'g-1', model: 'gemini-3-pro' }),
    );
    expect(session).toBe('g-1');
  });

  it('emits assistant message content and ignores the user echo', () => {
    const assistant = run(
      'gemini',
      JSON.stringify({ type: 'message', role: 'assistant', content: 'Hi there' }),
    );
    expect(assistant.texts).toEqual(['Hi there']);
    const user = run(
      'gemini',
      JSON.stringify({ type: 'message', role: 'user', content: 'prompt' }),
    );
    expect(user.texts).toEqual([]);
  });

  it('maps a tool_use to a chip with a scene-relative file path', () => {
    const { tools } = run(
      'gemini',
      JSON.stringify({
        type: 'tool_use',
        tool_name: 'write_file',
        tool_id: '1',
        parameters: { file_path: `${PROJECT}/src/Door.ts` },
      }),
    );
    expect(tools).toEqual([['Write', 'src/Door.ts']]);
  });

  it('shows the command for a shell tool_use', () => {
    const { tools } = run(
      'gemini',
      JSON.stringify({
        type: 'tool_use',
        tool_name: 'run_shell_command',
        parameters: { command: 'npm run build' },
      }),
    );
    expect(tools).toEqual([['Run', 'npm run build']]);
  });

  it('surfaces an error event as text so a failed turn is never silent', () => {
    const { texts } = run(
      'gemini',
      JSON.stringify({ type: 'error', severity: 'error', message: 'quota exceeded' }),
    );
    expect(texts).toEqual(['quota exceeded\n']);
  });

  it('surfaces a failed result error message', () => {
    const { texts } = run(
      'gemini',
      JSON.stringify({ type: 'result', status: 'error', error: { message: 'boom' } }),
    );
    expect(texts).toEqual(['boom\n']);
  });

  it('ignores non-JSON chatter', () => {
    const { session, texts, tools } = run('gemini', 'not json at all');
    expect(session).toBeUndefined();
    expect(texts).toEqual([]);
    expect(tools).toEqual([]);
  });
});

describe('gemini buildArgs', () => {
  const base = { text: 'hi', projectDir: PROJECT, images: [] as string[] };

  it('runs stream-json with full-access + workspace-trust flags', () => {
    const { args } = PROVIDERS.gemini.buildArgs({ ...base });
    expect(args.join(' ')).toContain('-o stream-json');
    expect(args).toContain('--yolo');
    expect(args).toContain('--skip-trust');
  });

  it('adds -m only for a non-default model', () => {
    expect(PROVIDERS.gemini.buildArgs({ ...base }).args).not.toContain('-m');
    const { args } = PROVIDERS.gemini.buildArgs({ ...base, model: 'gemini-3-flash' });
    expect(args[args.indexOf('-m') + 1]).toBe('gemini-3-flash');
  });

  // The DCL rules ride on stdin; the user prompt goes via -p. That keeps the ~7KB constant off
  // argv (Windows cmd.exe cap, #1588) while staying in the documented headless (-p) mode.
  it('puts the rules on stdin and the user prompt via -p, keeping the rules off argv', () => {
    const TOKEN = 'ZZ_USER_PROMPT_ZZ';
    const { args, stdin } = PROVIDERS.gemini.buildArgs({ ...base, text: TOKEN });
    expect(typeof stdin).toBe('string');
    expect((stdin ?? '').length).toBeGreaterThan(100); // the system prompt
    expect(stdin).not.toContain(TOKEN); // the user prompt is NOT in the rules blob
    expect(args[args.indexOf('-p') + 1]).toBe(TOKEN); // ...it's the -p value
    expect(args.join(' ').replace(TOKEN, '').length).toBeLessThan(100); // no big blob on argv
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
    const { args } = PROVIDERS.claude.buildArgs({ ...base, mcp: MCP });
    const i = args.indexOf('--mcp-config');
    expect(i).toBeGreaterThan(-1);
    expect(typeof args[i + 1]).toBe('string');
    expect(args.join(' ')).not.toContain(MCP.token); // token is in the file, never on the command line
  });

  it('claude: no --mcp-config when the server is unavailable', () => {
    expect(PROVIDERS.claude.buildArgs({ ...base }).args.join(' ')).not.toContain('--mcp-config');
  });

  it('codex: defines the HTTP MCP server via -c overrides, token via env var not argv', () => {
    const { args } = PROVIDERS.codex.buildArgs({ ...base, mcp: MCP });
    expect(args).toContain(`mcp_servers.creator-hub.url="${MCP.url}"`);
    expect(args).toContain('mcp_servers.creator-hub.bearer_token_env_var="CREATOR_HUB_MCP_TOKEN"');
    expect(args.join(' ')).not.toContain(MCP.token); // token comes from the child env, never argv
  });

  it('codex: no mcp_servers override when the server is unavailable', () => {
    expect(PROVIDERS.codex.buildArgs({ ...base }).args.join(' ')).not.toContain('mcp_servers');
  });

  // The regression this fixes: on Windows cross-spawn runs the CLI's `.cmd` shim through
  // `cmd.exe /c`, whose command line caps at 8191 chars. The ~7KB DCL system prompt inline on
  // argv overflowed it ("The command line is too long"), failing every turn. Both providers now
  // keep the big text OFF argv — Claude via a system-prompt FILE + the prompt on stdin, Codex
  // via the whole thing on stdin — so argv stays short regardless of prompt size.
  describe('keeps the system prompt off argv (Windows cmd.exe 8191-char cap)', () => {
    const TOKEN = 'ZZ_USER_PROMPT_ZZ';
    const big = { text: TOKEN, projectDir: PROJECT, images: [] as string[] };

    it('claude: prompt on stdin, system prompt via --append-system-prompt-file, none inline', () => {
      const { args, stdin } = PROVIDERS.claude.buildArgs({ ...big });
      const joined = args.join(' ');
      expect(joined).toContain('--append-system-prompt-file');
      expect(joined).not.toContain('--append-system-prompt '); // no inline string variant
      expect(stdin).toBe(TOKEN); // the user prompt rides on stdin, not argv
      expect(joined).not.toContain(TOKEN); // ...and is absent from argv
      // argv must stay well under cmd.exe's 8191-char limit
      expect(joined.length).toBeLessThan(2000);
    });

    it('codex: instructions (rules + prompt) on stdin via the `-` token, none inline', () => {
      const { args, stdin } = PROVIDERS.codex.buildArgs({ ...big });
      expect(args[args.length - 1]).toBe('-'); // read prompt from stdin
      expect(stdin).toContain(TOKEN); // prompt is on stdin
      expect(args.join(' ')).not.toContain(TOKEN); // ...not argv
      expect(args.join(' ').length).toBeLessThan(2000);
    });
  });
});

describe('friendlyCliError', () => {
  // The exact blob the old CLI relays for a model it can't serve (the Fable-on-2.1.39 case).
  const versionTooOld =
    'API Error: 400 {"type":"error","error":{"type":"invalid_request_error","message":"Claude Code 2.1.39 does not support this model; version 2.1.251 or newer is required. Run \'claude update\', or update the Claude desktop app, then try again.","details":{"error_code":"claude_code_version_too_old"}},"request_id":"req_011CeiMWbNfXe9zppoJqNSwo"}';

  it('rewrites the version-too-old blob to one actionable line', () => {
    const out = friendlyCliError(versionTooOld);
    expect(out).not.toContain('request_id');
    expect(out).not.toContain('{');
    expect(out).toContain('claude update');
  });

  it('matches on error_code alone', () => {
    expect(friendlyCliError('boom error_code":"claude_code_version_too_old"')).toContain('too old');
  });

  it('passes ordinary assistant text through untouched', () => {
    const text = 'Sure — I added a GltfContainer to the scene.';
    expect(friendlyCliError(text)).toBe(text);
  });
});
