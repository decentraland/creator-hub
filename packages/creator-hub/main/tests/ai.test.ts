import { describe, expect, it } from 'vitest';

import { PROVIDERS, nvmBinDirs, parseShellPath } from '../src/modules/ai';

const PROJECT = '/home/user/scene';

// Collect what a provider's parseLine emits, so a CLI output-format change is caught by
// something instead of silently dropping text or tool chips.
function run(provider: 'claude' | 'codex', line: string) {
  const texts: string[] = [];
  const tools: Array<[string, string]> = [];
  const session = PROVIDERS[provider].parseLine(line, PROJECT, (text, tool) => {
    if (text !== '') texts.push(text);
    if (tool !== undefined) tools.push(tool);
  });
  return { session, texts, tools };
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

  it('ignores partial (non-completed) items', () => {
    const { texts, tools } = run(
      'codex',
      JSON.stringify({ type: 'item.started', item: { type: 'agent_message', text: 'partial' } }),
    );
    expect(texts).toEqual([]);
    expect(tools).toEqual([]);
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
