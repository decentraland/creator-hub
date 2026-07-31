export type AgentEvent = Record<string, unknown> & { type: string };

export type ChatItem =
  | { kind: 'user'; text: string }
  | { kind: 'assistant'; text: string }
  | { kind: 'tool'; id: string; label: string; status: 'running' | 'done' | 'error' }
  | { kind: 'status'; text: string }
  | { kind: 'retry'; attempt: number; maxAttempts: number }
  | { kind: 'compaction' }
  | { kind: 'exit'; code: number | null }
  | { kind: 'error'; text: string }
  | { kind: 'scene_reloaded' };

export type ChatState = {
  items: ChatItem[];
  busy: boolean;
  exited: boolean;
  filesChanged: boolean;
};

export type ChatAction =
  | { type: 'prompt'; text: string }
  | { type: 'error'; text: string }
  | { type: 'reset' }
  | { type: 'restore'; items: ChatItem[] }
  | { type: 'scene_reloaded' }
  | { type: 'event'; event: AgentEvent; projectPath: string };

export const INITIAL_CHAT_STATE: ChatState = {
  items: [],
  busy: false,
  exited: false,
  filesChanged: false,
};

const TOOL_PATH_ARGS = ['path', 'file_path', 'filePath', 'file'];

// Tools that can modify files on disk (bash included: scripts can write anywhere)
const MUTATING_TOOLS = new Set(['edit', 'write', 'bash']);

/**
 * Builds a compact one-line label for a tool call, e.g. "edit src/index.ts".
 */
export function getToolLabel(toolName: string, args: unknown, projectPath: string): string {
  let detail: string | undefined;
  if (args && typeof args === 'object') {
    const record = args as Record<string, unknown>;
    for (const key of TOOL_PATH_ARGS) {
      if (typeof record[key] === 'string') {
        detail = record[key] as string;
        break;
      }
    }
    if (!detail && typeof record.command === 'string') {
      detail = record.command;
    }
  }
  if (detail && projectPath && detail.startsWith(projectPath)) {
    detail = detail.slice(projectPath.length).replace(/^[/\\]/, '');
  }
  return detail ? `${toolName} ${detail}` : toolName;
}

/**
 * Extracts a readable message from a provider error string like
 * '400 {"type":"error","error":{"type":"invalid_request_error","message":"..."}}'.
 */
export function extractApiErrorMessage(raw: string): string {
  const jsonStart = raw.indexOf('{');
  if (jsonStart !== -1) {
    try {
      const parsed = JSON.parse(raw.slice(jsonStart)) as {
        error?: { message?: unknown };
        message?: unknown;
      };
      const message = parsed.error?.message ?? parsed.message;
      if (typeof message === 'string' && message.length > 0) return message;
    } catch {
      // fall through to raw string
    }
  }
  return raw;
}

/**
 * Rebuilds the transcript from a pi session's message history (the shape
 * returned by the `get_messages` RPC command): user text, assistant text,
 * and completed tool calls. Thinking blocks are skipped, matching the live
 * rendering.
 */
export function mapMessagesToChatItems(messages: unknown[], projectPath: string): ChatItem[] {
  const items: ChatItem[] = [];
  for (const raw of messages) {
    if (!raw || typeof raw !== 'object') continue;
    const message = raw as Record<string, unknown>;
    const content = message.content;
    if (message.role === 'user') {
      let text = '';
      if (typeof content === 'string') {
        text = content;
      } else if (Array.isArray(content)) {
        text = content
          .filter(part => part && typeof part === 'object' && part.type === 'text')
          .map(part => String((part as Record<string, unknown>).text ?? ''))
          .join('\n');
      }
      if (text.trim()) items.push({ kind: 'user', text });
    } else if (message.role === 'assistant' && Array.isArray(content)) {
      for (const part of content) {
        if (!part || typeof part !== 'object') continue;
        const record = part as Record<string, unknown>;
        if (record.type === 'text' && typeof record.text === 'string' && record.text.trim()) {
          items.push({ kind: 'assistant', text: record.text });
        } else if (record.type === 'toolCall') {
          items.push({
            kind: 'tool',
            id: String(record.id ?? ''),
            label: getToolLabel(String(record.name ?? 'tool'), record.arguments, projectPath),
            status: 'done',
          });
        }
      }
    } else if (message.role === 'toolResult' && message.isError === true) {
      const toolCallId = String(message.toolCallId ?? '');
      for (let i = items.length - 1; i >= 0; i--) {
        const item = items[i];
        if (item.kind === 'tool' && item.id === toolCallId) {
          items[i] = { ...item, status: 'error' };
          break;
        }
      }
    }
  }
  return items;
}

function appendItem(state: ChatState, item: ChatItem): ChatState {
  return { ...state, items: [...state.items, item] };
}

function appendAssistantText(state: ChatState, delta: string): ChatState {
  const items = [...state.items];
  const last = items[items.length - 1];
  if (last && last.kind === 'assistant') {
    items[items.length - 1] = { ...last, text: last.text + delta };
  } else {
    items.push({ kind: 'assistant', text: delta });
  }
  return { ...state, items };
}

function updateToolStatus(
  state: ChatState,
  toolCallId: string,
  status: 'done' | 'error',
): ChatState {
  const items = state.items.map(item =>
    item.kind === 'tool' && item.id === toolCallId ? { ...item, status } : item,
  );
  return { ...state, items };
}

function reduceAgentEvent(state: ChatState, event: AgentEvent, projectPath: string): ChatState {
  switch (event.type) {
    case 'agent_start':
      return { ...state, busy: true };
    case 'agent_end':
      return { ...state, busy: false };
    case 'message_update': {
      const delta = event.assistantMessageEvent as Record<string, unknown> | undefined;
      if (!delta) return state;
      if (delta.type === 'text_start') {
        return appendItem(state, { kind: 'assistant', text: '' });
      }
      if (delta.type === 'text_delta' && typeof delta.delta === 'string') {
        return appendAssistantText(state, delta.delta);
      }
      if (delta.type === 'error') {
        const reason = typeof delta.reason === 'string' ? delta.reason : 'error';
        return appendItem(state, { kind: 'error', text: reason });
      }
      return state;
    }
    case 'message_end': {
      const message = event.message as Record<string, unknown> | undefined;
      if (
        message &&
        message.role === 'assistant' &&
        message.stopReason === 'error' &&
        typeof message.errorMessage === 'string'
      ) {
        return appendItem(
          { ...state, busy: false },
          {
            kind: 'error',
            text: extractApiErrorMessage(message.errorMessage),
          },
        );
      }
      return state;
    }
    case 'tool_execution_start': {
      const id = typeof event.toolCallId === 'string' ? event.toolCallId : '';
      const toolName = typeof event.toolName === 'string' ? event.toolName : 'tool';
      return appendItem(state, {
        kind: 'tool',
        id,
        label: getToolLabel(toolName, event.args, projectPath),
        status: 'running',
      });
    }
    case 'tool_execution_end': {
      const id = typeof event.toolCallId === 'string' ? event.toolCallId : '';
      const next = updateToolStatus(state, id, event.isError ? 'error' : 'done');
      if (
        !event.isError &&
        typeof event.toolName === 'string' &&
        MUTATING_TOOLS.has(event.toolName)
      ) {
        return { ...next, filesChanged: true };
      }
      return next;
    }
    case 'response': {
      if (event.success === false) {
        const error = typeof event.error === 'string' ? event.error : 'Unknown error';
        return appendItem({ ...state, busy: false }, { kind: 'error', text: error });
      }
      return state;
    }
    case 'agent_exit': {
      const code = typeof event.code === 'number' ? event.code : null;
      return appendItem({ ...state, busy: false, exited: true }, { kind: 'exit', code });
    }
    case 'extension_ui_request': {
      if (event.method === 'notify' && typeof event.message === 'string') {
        return appendItem(state, { kind: 'status', text: event.message });
      }
      return state;
    }
    case 'auto_retry_start': {
      const attempt = typeof event.attempt === 'number' ? event.attempt : 1;
      const maxAttempts = typeof event.maxAttempts === 'number' ? event.maxAttempts : 1;
      return appendItem(state, { kind: 'retry', attempt, maxAttempts });
    }
    case 'compaction_start':
      return appendItem(state, { kind: 'compaction' });
    default:
      return state;
  }
}

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'prompt':
      return appendItem({ ...state, busy: true }, { kind: 'user', text: action.text });
    case 'error':
      return appendItem({ ...state, busy: false }, { kind: 'error', text: action.text });
    case 'reset':
      return INITIAL_CHAT_STATE;
    // Replaces the transcript but keeps busy/exited flags: a restore can race
    // with a turn that is still streaming from before the panel was reopened.
    case 'restore':
      return { ...state, items: action.items };
    case 'scene_reloaded':
      return appendItem({ ...state, filesChanged: false }, { kind: 'scene_reloaded' });
    case 'event':
      return reduceAgentEvent(state, action.event, action.projectPath);
    default:
      return state;
  }
}
