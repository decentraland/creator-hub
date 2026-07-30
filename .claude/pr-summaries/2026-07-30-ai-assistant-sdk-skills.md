# AI Assistant: auto-install official Decentraland SDK skills for the agent

## Overview

The OpenDCL coding agent used by the AI Assistant ships its own (outdated) bundled skills. This change makes every scene project automatically receive the latest official skills from `github.com/decentraland/sdk-skills` whenever the agent starts, with no manual steps and full offline resilience.

## Official SDK skills auto-install

### Behavior

- When the AI agent starts for a project, the latest official SDK skills are installed into `<project>/.agents/skills/` (a dot-directory, so it is excluded from scene deployments by the default `.dclignore`).
- Skills are cached app-wide in `<userData>/sdk-skills/` so only the first agent start ever downloads them; per-project installs are local file copies (~1s download once, ~1ms no-op afterwards).
- Cache refresh policy: fresher than 24h → used as-is; older → the GitHub API is checked for a new commit; unchanged sha just bumps the timestamp, a new sha re-downloads and atomically swaps the cache. Any network failure keeps the existing cache silently.
- Per-project sync is marker-based (`.agents/skills/.dcl-sdk-skills.json` records the installed commit sha and the skill names we own): matching sha is a no-op, a new sha overwrites owned skills and removes owned skills deleted upstream, and directories the user added themselves are never touched.
- The whole flow never throws: offline or GitHub-down, the agent still starts (falling back to opendcl's bundled skills on a cold cache).
- The agent is spawned with `--skill <project>/.agents/skills` placed before opendcl's own arguments; since pi keeps the first skill found on a name collision and opendcl appends its bundled skill dir last, every skill the agent sees is the official one (the only bundled skill that survives is `visual-feedback`, which has no official counterpart).

### Implementation

- New module `packages/creator-hub/main/src/modules/sdk-skills.ts`:
  - `ensureSdkSkills(projectPath)` — never-throwing entry point called from `ai.ts` before spawning; refreshes the app-level cache (deduplicating concurrent refreshes) and syncs it into the project.
  - `syncProjectSkills(cacheRoot, projectPath)` — exported separately so the marker/ownership logic is unit-testable against plain temp dirs.
  - Download uses the shared `fetch` wrapper (30s timeout), the `codeload.github.com` tarball for the exact commit sha, system `tar -xzf` for extraction (no new npm dependencies), and `fs.cp` staging + `rename` swap so a concurrent reader never sees a half-written cache. Only top-level repo directories containing a `SKILL.md` are cached.
- `packages/creator-hub/main/src/modules/ai.ts` — awaits `ensureSdkSkills(path)` before spawn and prepends `--skill <project>/.agents/skills` to the opendcl args when that directory exists.
- `renderer/src/modules/store/translation/locales/{en,es,zh}.json` — `editor.ai_assistant.starting` now mentions that the first run may take a minute while the SDK skills are installed.

## Testing

- New unit tests `packages/creator-hub/main/tests/sdk-skills.test.ts` (5 tests, real fs in `os.tmpdir()` fixtures, no network): fresh install into `.agents/skills` with marker, no-op when the marker sha matches, update + stale-owned-skill removal on sha change, user-added skill dirs preserved across updates, and graceful `false` when the cache is empty.
- Verified still passing: `npm run test:main` (38 tests), `npm run typecheck`, ESLint and Prettier on all touched files.
- Live smoke test (throwaway dirs): first `ensureSdkSkills` run downloaded and cached 27 skills at the current `sdk-skills` head commit and installed them with the marker; the second run was a ~1ms no-op that left locally modified files untouched.
- Agent integration check: spawned opendcl in RPC mode with the exact args `ai.ts` now uses against the throwaway project; `get_commands` reported all 27 official skills loaded (including official-only `composites`, `script-components`, `sdk-scenes`, `migrate-sdk6-to-sdk7`), with skill descriptions matching the official repo versions rather than opendcl's bundled copies.
