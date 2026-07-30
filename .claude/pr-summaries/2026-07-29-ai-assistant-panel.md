# AI Assistant chat panel (POC): embed the OpenDCL coding agent in the scene editor

## Overview

Proof-of-concept "AI Assistant" chat panel in the Creator Hub scene editor. It embeds the
OpenDCL coding agent (`@dcl-regenesislabs/opendcl`, a wrapper over
`@mariozechner/pi-coding-agent`) running fully locally as a child process in headless RPC
mode (JSONL over stdio). Users provide their own Anthropic API key; prompts typed in the
panel let the agent edit the scene project files on disk while the panel streams the
agent's text output and tool activity.

## AI agent process management (main)

**Behavior**

- `ai.start(path)` spawns one agent per project (`opendcl --mode rpc --headless --model anthropic/claude-sonnet-4-5`)
  with `cwd` set to the scene folder, `ELECTRON_RUN_AS_NODE=1` (the Electron binary acts
  as Node 22), and `ANTHROPIC_API_KEY` read from the app config. Repeated calls reuse a
  live agent. Throws if no API key is configured.
- Every JSON object the agent prints on stdout is forwarded verbatim to the renderer on
  an `ai://<path>` webContents channel; a synthetic `{ type: 'agent_exit', code }` event
  is emitted when the child dies. stderr is logged to electron-log.
- Dialog-style `extension_ui_request`s (`select` / `confirm` / `input` / `editor`) are
  auto-cancelled on stdin so the agent never hangs (auto-confirming is not safe);
  `notify` and other fire-and-forget requests are just forwarded.
- `ai.prompt` / `ai.abort` write `prompt` / `abort` commands to the agent's stdin;
  `ai.stop` kills it; `ai.getState` reports `{ running, hasApiKey }`. All agents are
  killed on window close / app quit via the existing `killAll()` cleanup.

**Implementation**

- New `main/src/modules/ai.ts`: agent registry (`Map<projectPath, AgentProcess>`),
  spawn/stop/prompt/abort/getState, event forwarding via `getWindow(MAIN_WINDOW_ID)`.
- New `main/src/modules/jsonl.ts`: protocol-compliant JSONL framing — splits on LF only
  (stripping a trailing CR) with a manual buffer + `StringDecoder`, because Node
  `readline` also splits on U+2028/U+2029 which are valid inside JSON strings; plus a
  tolerant single-line parser (pi can print stray non-JSON on startup).
- The agent entry is resolved with the existing `getBinPath()` helper, with a fallback to
  the monorepo root `node_modules` for the case where the production bundles run straight
  from the source tree (the Playwright e2e harness) and `app.asar.unpacked` doesn't exist.
- IPC channels registered in `main/src/modules/ipc.ts`; types in `shared/types/ipc.ts`
  (`ai.start`, `ai.stop`, `ai.prompt`, `ai.abort`, `ai.getState`).
- New dependency: `@dcl-regenesislabs/opendcl@^0.2.1` in `packages/creator-hub`.

## API key setting

**Behavior**

- The Anthropic API key is stored in the existing app config (`config.json`) under
  `settings.aiAgent.anthropicApiKey` (plaintext — acceptable for the POC). No new IPC:
  the renderer writes it through the existing settings update flow; main reads it at
  spawn time.

**Implementation**

- `AppSettings` in `shared/types/settings.ts` gains an optional
  `aiAgent?: { anthropicApiKey?: string }` field; the panel saves it via the existing
  `workspace.updateSettings` thunk.

## Chat panel (renderer)

**Behavior**

- New "AI" button (sparkle icon) in the scene editor toolbar toggles a right-side panel
  next to the inspector iframe.
- First open without an API key: a short explainer, a password-type key field and a
  "Save and start" button. Saving stores the key and starts the agent.
- Chat view: user bubbles; assistant text accumulated from `text_delta` events (thinking
  deltas ignored); compact tool-activity lines from `tool_execution_start/end` (e.g.
  "edit src/index.ts", with running/done/error state); status lines for agent `notify`
  messages, auto-retry, and compaction; a "Working..." busy indicator between
  `agent_start` and `agent_end`; errors surfaced from failed command responses, stream
  errors, and agent exit.
- Input: multiline; Enter sends, Shift+Enter inserts a newline; while the agent is
  running the input is disabled and a Stop button (sends `abort`) replaces Send.
- Messages are kept in memory only. Closing the panel unsubscribes but leaves the agent
  process running, so the session survives panel toggles.

**Implementation**

- New `renderer/src/components/EditorPage/AiAssistant/`:
  - `chat.ts` — pure event-to-chat-state reducer (`chatReducer`, `getToolLabel`),
    unit-testable without the DOM.
  - `component.tsx` — panel component (component-local state via `useReducer`).
  - `component.styled.ts` — decentraland-ui2 `styled()` object syntax with theme tokens.
- New preload module `preload/src/modules/ai.ts` with `subscribeAiEvents(path, cb)`
  following the `attachSceneDebugger` pattern (StrictMode double-mount guard included).
- `EditorPage` wraps the inspector iframe and the panel in a flex `.content` container
  (`styles.css`).
- All user-facing strings go through react-intl (`editor.ai_assistant.*` keys added to
  `en.json`, `es.json`, `zh.json`).

## Testing

- New unit tests (Vitest, `describe("when ...")` / `it("should ...")`):
  - `main/tests/jsonl.test.ts` — JSONL splitter (multi-record chunks, split records,
    CRLF, U+2028/U+2029 inside JSON strings, split multi-byte UTF-8, flush on end) and
    line parser (non-JSON, non-object JSON).
  - `renderer/.../AiAssistant/chat.spec.ts` — chat reducer (prompt/busy, text delta
    accumulation, thinking ignored, tool lifecycle, failed responses, agent exit,
    notify) and tool label formatting.
- `npm run typecheck` (main, preload, renderer), ESLint and Prettier pass on all touched
  files; full unit suites for main (33), preload (23), renderer (139) and shared (26)
  pass.
- Verified end-to-end in the real Electron app (Playwright, throwaway profile): opened a
  scene, toggled the panel, captured the API-key setup view, saved a fake key, and
  confirmed the OpenDCL agent process spawns from inside the app and the chat view
  renders (no LLM calls made). Spawning `opendcl --mode rpc --headless` and exchanging a
  `get_state` command over stdio was also verified standalone, including that
  `--model anthropic/claude-sonnet-4-5` resolves (without the pin, pi picked a
  non-Anthropic default from local state).
