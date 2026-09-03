# Creator Hub — Onboarding

Creator Hub is Decentraland's desktop app (Electron) for building SDK7 scenes. It's an npm-workspaces monorepo:

- **`@dcl/asset-packs`** — curated 3D assets + Smart Items.
- **`@dcl/inspector`** — the web-based 3D scene editor (Babylon.js + Redux/Redux-Saga), embedded as an iframe.
- **`creator-hub`** — the Electron app (main / preload / renderer) that wraps the inspector.

Deps flow `asset-packs → inspector → creator-hub` (each linked via `file:`).

## Get set up

```bash
make init          # clean, install, protoc, build all
make build         # build all packages (asset-packs → inspector → creator-hub)
cd packages/creator-hub && npm run start   # run the app in watch mode
make test          # unit tests (vitest)   ·  make typecheck  ·  make lint
```

Node 22+. Read **`CLAUDE.md`** (architecture + hard-won gotchas), **`docs/coding-standards.md`**, and **`docs/testing-standards.md`** before touching code — they override defaults.

---

## The AI Scene Agent

An in-editor AI chat panel that drives the user's **own installed `claude` / `codex` CLI** to build scenes — read the scene, write SDK7 code, mutate the scene graph, and run + drive the preview. It bills against the user's subscription (API keys are stripped by default), so there are no metered keys to manage.

**Turn it on** (it's behind a feature flag, off by default): in a dev build set
`localStorage['creator-hub:feature-flags'] = '{"creatorhub-ai-chat":true}'`. The 🤖 "Toggle AI assistant" button then appears in the editor header.

### Mental model

Four moving parts, one per process boundary:

1. **Chat panel** (renderer) — `renderer/src/components/AiChatPanel`, a flex sibling of the inspector iframe in `EditorPage`. Redux slice `renderer/src/modules/store/ai`. It only sends prompts and renders streamed events.
2. **Agent runner** (main) — `main/src/modules/ai.ts` raw-spawns the user's CLI, one child per turn, and parses its NDJSON stdout into events streamed back over the `ai.*` IPC channels. System prompt in `ai-prompt.ts`.
3. **Scene MCP server** (main) — `main/src/modules/scene-mcp.ts`. A localhost, token-gated, **stateful** MCP server (streamable HTTP, one transport per session) handed to the CLI as its tool source. Read tools read the scene's `main.composite` straight from disk; **mutations, metrics, and selection go main → renderer → inspector-iframe over the SceneRpc bridge**, where the inspector runs its real operations on the live engine — so the viewport updates and undo + autosave come for free.
4. **Explorer gateway** (main) — `main/src/modules/explorer-gateway.ts`. On `launch_preview` it starts the Decentraland preview with its `unity-explorer-mcp` server on, connects to it as an MCP *client*, and republishes the Explorer's runtime tools as dynamic `explorer_*` tools (screenshot, walk, click, logs, perf). The stateful server is what lets it push `tools/list_changed` so those tools appear/disappear live.

### The tools the agent gets

Read: `get_project_info`, `scene_state`, `entity_detail`, `get_selection`, `get_scene_metrics`, `editor_screenshot`.
Mutate (all live + undoable): `create_entity`, `remove_entity`, `set_parent`, `set_component`, `remove_component`, `search_catalog`, `place_smart_item`, `attach_script`.
Preview: `launch_preview`, `preview_status`, `stop_preview`, `explorer_call` + the dynamic `explorer_*` set.

Each turn's mutations are counted, so a one-click **"Undo AI changes"** reverts a whole turn. Conversations persist per project (transcript in the renderer, `--resume` ids in main) and survive a restart.

### Where the code lives

| Layer | Files |
|---|---|
| main | `modules/ai.ts` (spawn/stream/env), `ai-prompt.ts`, `scene-mcp.ts` (server + tools + bridge), `explorer-gateway.ts`, `skills.ts` (sdk-skills) |
| preload | `modules/ai.ts` |
| renderer | `components/AiChatPanel`, `components/EditorPage` (the `SCENE_OP_HANDLERS` bridge + effects), `modules/store/ai` (slice, `persistence.ts`, `labels.ts`) |
| inspector | `src/lib/rpc/scene/server.ts` — the `SceneServer`: every read/mutation handler runs here on the live engine |
| shared | `types/ai.ts`, `types/ipc.ts` |

### How to test it

- **Unit:** `npm run test:unit` (main/preload/renderer/shared) and, in `packages/inspector`, `npm run test`. The load-bearing suites are `main/tests/{ai,scene-mcp,explorer-gateway}.test.ts` and `inspector` `scene.spec.ts`.
- **Live (needs a real GPU window):** the viewport, mutations, metrics, and the gateway only work with real WebGL, which Playwright's `_electron.launch` does **not** give you. Launch a raw `electron .` with `--remote-debugging-port` and attach via `chromium.connectOverCDP`. Enable the flag (temp-patch `overrides.ts` or DEV localStorage), and open a scene that **already has `node_modules`** — the unpackaged `electron .` can't npm-install on open.

### Gotchas

- **The engine owns the scene graph.** Never write `main.composite`, `scene.json`, or `main.crdt` on disk — the inspector's autosave clobbers external edits within ~100 ms. Change the scene only through the tools.
- **Stateful MCP server on purpose.** One transport per `Mcp-Session-Id`. That's the correct fix for the original "Server already initialized" bug (which came from sharing one transport) and it's what enables `tools/list_changed`. Don't revert to a shared/stateless transport.
- **Redux freeze.** Deep-clone (`structuredClone`) any Redux-sourced payload before passing it to an in-place mutating helper, or it throws.
- **Providers.** Claude and Codex both get the full tool suite (Codex via `-c mcp_servers…` overrides). Gemini isn't wired yet.

Deeper design notes and the full test/harness recipes live in `CLAUDE.md` and `docs/`.
