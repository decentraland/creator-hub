---
name: beautify-release-changelog
description: Transforms raw GitHub release notes (What's Changed with PR links and @mentions) into a verbose, user-friendly, product-ready changelog with sections (New features, Fixes, Improvements). By default fetches each merged PR body and writes short, well-redacted summaries suitable for release notes and product marketing. Can fetch the latest creator-hub pre-release (tag x.y.z) via curl. Use when drafting or editing a release changelog, beautifying release notes, or when the user asks for the latest pre-release changelog.
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
- Optional prefixes: `fix:`, `feat:` (use these as hints for classification).

Strip PR URLs and @mentions when rewriting; do not include them in the beautified bullets. From each bullet extract the PR URL to fetch the PR body (default workflow below).

## Classification rules

Assign each item to one of:

- **New features** — `feat:` prefix, or titles that describe new capabilities (e.g. multi-scene worlds, new component, new actions).
- **Fixes** — `fix:` prefix, or titles that describe bug fixes or corrections (e.g. "trigger area activates only on your player", "Scale gizmo white center fix", "fix virtual camera component").
- **Improvements** — UX or quality improvements that are not new features nor bugfixes (e.g. "remove save icon" as UI cleanup). Use an "Improvements" section; if there are very few items, you may merge into Fixes or omit the section.

Output sections in this order: New features, Fixes, Improvements. Omit any section that has no items.

## Output structure

Use this template. Omit empty sections.

```markdown
## New features

- [Bullet in user-facing prose]
- ...

## Fixes

- [Bullet in user-facing prose]
- ...

## Improvements

- [Bullet in user-facing prose]
- ...
```

Optionally keep the "Full Changelog" compare URL at the end if it was in the input and the user did not ask to remove it.

## Default: verbose, user-friendly, product-ready output

**By default**, produce a verbose, friendly, product-ready changelog. Fetch each merged PR and use its body to write a short, well-redacted summary.

**Workflow:**

1. Parse each raw bullet to extract the PR URL (e.g. `https://github.com/decentraland/creator-hub/pull/1142` → repo `decentraland/creator-hub`, PR number `1142`).
2. For each PR, fetch the PR body via GitHub API with **curl**:
   - `curl -s "https://api.github.com/repos/<owner>/<repo>/pulls/<number>"` (for merged PRs the pulls endpoint still returns the PR; use the same repo as in the release, typically `decentraland/creator-hub`).
   - From the JSON response, use the `body` field (and optionally `title`) to understand what the PR does.
3. Write a **small summary** (1–3 sentences) per item that is:
   - **User-focused**: Emphasize what the user can do or what improves for them, not implementation details.
   - **Well redacted**: Clear, welcoming language; avoid internal jargon, ticket refs, or raw technical terms unless helpful.
   - **Product-ready**: Suitable for release notes and product marketing; highlights benefits and is easy to read.

**Example:** If the PR title is "fix: Devtools" and the body mentions "fixes the devtools panel for inspecting scene web traffic", write something like: "**Devtools** — The Devtools panel for inspecting your scene’s web traffic is working again, so you can debug network requests and preview behavior with confidence."

**Rate limits:** Unauthenticated GitHub API requests are limited (e.g. 60/hour). If the release has many PRs, use an optional `Authorization: Bearer <token>` header (user can set `GITHUB_TOKEN`) to avoid hitting the limit.

**Output:** Keep the same sections (New features, Fixes, Improvements) and classification rules. Use bold labels and short paragraphs (1–3 sentences) per item. You may use a format like "**Feature name** — Summary sentence."

**Fallback:** If the user explicitly asks for a **short** or **concise** changelog, or if PR fetch fails (e.g. rate limit, network), use title-only rewriting as in "Short format (fallback)" below.

## Short format (fallback)

Use only when the user asks for a short/concise changelog or when PR bodies cannot be fetched.

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
## New features

- **Multi-scene worlds** — You can now publish and manage worlds that contain multiple scenes. Assign collaborator permissions per world and build richer experiences.

## Fixes

- **Devtools** — The Devtools panel for inspecting your scene’s web traffic is working again, so you can debug network requests with confidence.
- **Save icon** — The unused "Save" icon has been removed from the top bar for a cleaner interface.
```

**Short format (fallback, when user asks for concise or PR fetch fails):**

```markdown
## New features

- Multi-scene worlds support

## Fixes

- Fix devtools for viewing scene web traffic
- Remove unused "Save" icon from the top bar
```

## Additional resources

- For a full "What's Changed" to beautified output example, see [examples.md](examples.md).
