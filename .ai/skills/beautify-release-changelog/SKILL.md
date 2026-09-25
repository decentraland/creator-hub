---
name: beautify-release-changelog
description: Transforms raw GitHub release notes (What's Changed with PR links and @mentions) into a verbose, user-friendly, product-ready changelog with emoji sections (✨ New & Improved, 🔧 Changes, 🐛 Fixes). By default fetches each merged PR body and writes short, well-redacted summaries suitable for release notes and product marketing. Can fetch the latest creator-hub pre-release (tag x.y.z) via curl. Use when drafting or editing a release changelog, beautifying release notes, or when the user asks for the latest pre-release changelog.
---

# Beautify Release Changelog

## When to use

Apply this skill when the user:

- Pastes "What's Changed" or raw release notes and asks to beautify or format them
- Asks to beautify the release changelog
- Asks for the latest creator-hub pre-release changelog (and does not paste content)

## Getting the source

1. **If the user pastes release notes** — Use that content as the input and proceed to parse and beautify. You do not need a release tag in the output unless they ask.

2. **If the user did not paste content** — Fetch the latest creator-hub pre-release from GitHub and use its release body:
   - Use **curl** (no dependency on `gh`): `curl -s "https://api.github.com/repos/decentraland/creator-hub/releases"`
   - Parse the JSON response. Filter to keep only releases where `prerelease === true`.
   - Further filter: keep only releases whose `tag_name` matches **x.y.z** (e.g. `0.33.4`, `0.34.0`). Use regex `^\d+\.\d+\.\d+$` on `tag_name` so only the creator-hub app pre-release is used.
   - Sort the filtered list by `published_at` descending; take the first (most recent).
   - Use that release's `body` as the "What's Changed" input. Remember the release `tag_name` and include it in the final output (e.g. "Source: release 0.34.0").

No token is required for reading. Fetching uses curl only.

## Input format

Expect markdown list items of the form:

- `* Title by @user in https://github.com/.../pull/N`
- Optional prefixes: `fix:`, `feat:`, `chore:`, `style:` (use these as hints for classification).

Strip PR URLs and @mentions when rewriting; do not include them in the beautified output. From each bullet extract the PR URL to fetch the PR body (default workflow below).

## Classification rules

Assign each item to one of:

- **✨ New & Improved** — `feat:` prefix, titles that describe new capabilities (e.g. multi-scene worlds, new component, new actions), and user-visible UX or quality improvements (e.g. UI polish, a feature promoted to stable).
- **🔧 Changes** — behavior or policy changes a creator should know about that add no capability and fix no bug: a removed step or warning, a changed default, runtime/tooling consistency (e.g. "every child process now resolves a single Node runtime").
- **🐛 Fixes** — `fix:` prefix, or titles that describe correcting broken behavior (e.g. "trigger area activates only on your player", "fix virtual camera component").

Use the prefix as a hint, not a rule: a `fix:` PR whose effect is a behavior change (e.g. "stop gating publish completion on LOD generation") belongs in 🔧 Changes.

Leave out repo-internal chores that do not change the app: CI workflows, PR templates, test infrastructure, release pipelines.

Output sections in this order: ✨ New & Improved, 🔧 Changes, 🐛 Fixes. Omit any section that has no items. Use the headings exactly as written, emoji included.

## Output structure

Use this template. Omit empty sections.

```markdown
## ✨ New & Improved

### [Feature name]

[1–3 sentences in user-facing prose.]

### [Feature name]

[...]

## 🔧 Changes

- [One-line behavior change in user-facing prose]

## 🐛 Fixes

- **[Area]:** [What now works]
- [Fix with no specific area]
```

Optionally keep the "New Contributors" section and the "Full Changelog" compare URL at the end if they were in the input and the user did not ask to remove them.

## Default: verbose, user-friendly, product-ready output

**By default**, produce a verbose, friendly, product-ready changelog. Fetch each merged PR and use its body to write a short, well-redacted summary.

**Workflow:**

1. Parse each raw bullet to extract the PR URL (e.g. `https://github.com/decentraland/creator-hub/pull/1142` → repo `decentraland/creator-hub`, PR number `1142`).
2. For each PR, fetch the PR body via GitHub API with **curl**:
   - `curl -s "https://api.github.com/repos/<owner>/<repo>/pulls/<number>"` (for merged PRs the pulls endpoint still returns the PR; use the same repo as in the release, typically `decentraland/creator-hub`).
   - From the JSON response, use the `body` field (and optionally `title`) to understand what the PR does.
   - If the body is empty, read the issues it closes (`/issues/<n>`) and its changed files (`/pulls/<n>/files`) before falling back to the title.
3. Write each item in its section's shape:
   - **✨ New & Improved** — a `### Feature name` heading, then a 1–3 sentence paragraph. Prefix the name with its product area when that helps (`### AI Assistant — Cursor and Gemini providers`, `### Inspector — numeric transform entry`).
   - **🔧 Changes** — one plain bullet per change.
   - **🐛 Fixes** — one bullet per fix, prefixed with a bold area when it belongs to one (`**UI Designer:**`, `**Bevy editor:**`, `**AI Assistant:**`, `**Inspector:**`). Group small related fixes into one bullet ("Fixed five quality-of-life bugs: a, b, c, d, and e.").
4. Keep the wording:
   - **User-focused**: Emphasize what the user can do or what improves for them, not implementation details.
   - **Well redacted**: Clear, welcoming language; avoid internal jargon, ticket refs, or raw technical terms unless helpful.
   - **Product-ready**: Suitable for release notes and product marketing; highlights benefits and is easy to read.
   - Bold the names of UI controls, keys and providers (**Preview**, **F**, **Cursor**).

**Example:** If the PR title is "fix: Devtools" and the body mentions "fixes the devtools panel for inspecting scene web traffic", write the 🐛 Fixes bullet: "- **Devtools:** The panel for inspecting your scene's web traffic works again, so you can debug network requests with confidence."

**Rate limits:** Unauthenticated GitHub API requests are limited (e.g. 60/hour). If the release has many PRs, use an optional `Authorization: Bearer <token>` header (user can set `GITHUB_TOKEN`) to avoid hitting the limit.

**Fallback:** If the user explicitly asks for a **short** or **concise** changelog, or if PR fetch fails (e.g. rate limit, network), use title-only rewriting as in "Short format (fallback)" below.

## Short format (fallback)

Use only when the user asks for a short/concise changelog or when PR bodies cannot be fetched.

- Keep the same three emoji headings, but write ✨ New & Improved items as bullets instead of `###` blocks.
- Start bullets with a verb or clear noun phrase; use present or past tense as appropriate.
- One clear idea per bullet. Merge related PRs into one bullet when they clearly belong together.
- Grammatically correct and concise. No PR links or @mentions in the bullet text.

## After output: ask before updating

Do **not** automatically update the GitHub release body.

1. **Show the result** — Output the full beautified changelog. If you fetched from GitHub, include which release tag was used (e.g. "Source: release 0.34.0").
2. **Ask the user** — Explicitly ask: "Do you want to update the release body on GitHub with this content?"
3. **If the user says yes** — Use the **`gh` CLI** for the update only. The release-body update step **requires `gh`** (installed and authenticated):
   - Example: `gh release edit <tag> --repo decentraland/creator-hub --notes-file -` (pipe the beautified markdown), or `gh release edit <tag> --repo decentraland/creator-hub --notes "…"` with the content.
   - If `gh` is not available or not authenticated, tell the user to install the GitHub CLI and run `gh auth login`, then either re-run the update or run the `gh release edit` command manually with the beautified content.

Fetching continues to use curl; only the update step uses `gh`.

## Short example

**Input (raw):**

```
* fix: Devtools by @cyaiox in https://github.com/decentraland/creator-hub/pull/1109
* feat: Multi-Scene Worlds by @RocioCM in https://github.com/decentraland/creator-hub/pull/1089
* remove save icon by @nearnshaw in https://github.com/decentraland/creator-hub/pull/1152
```

**Output (default: verbose, product-ready):**

```markdown
## ✨ New & Improved

### Multi-scene worlds

You can now publish and manage worlds that contain multiple scenes. Assign collaborator permissions per world and build richer experiences.

## 🔧 Changes

- The unused **Save** icon has been removed from the top bar for a cleaner interface.

## 🐛 Fixes

- **Devtools:** The panel for inspecting your scene's web traffic works again, so you can debug network requests with confidence.
```

**Short format (fallback, when user asks for concise or PR fetch fails):**

```markdown
## ✨ New & Improved

- Multi-scene worlds support

## 🔧 Changes

- Remove unused "Save" icon from the top bar

## 🐛 Fixes

- Fix devtools for viewing scene web traffic
```

## Additional resources

- For a full "What's Changed" to beautified output example, see [examples.md](examples.md).
