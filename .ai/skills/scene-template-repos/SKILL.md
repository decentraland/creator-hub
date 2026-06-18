---
name: scene-template-repos
description: This skill should be used when applying changes across the Decentraland scene template repositories (e.g. updating scene.json, modifying code, fixing configs). It covers cloning, branching, editing, committing, and pushing to the 12 template repos that power the Creator Hub "New Scene" page. Triggers on requests like "update all template repos", "change spawn points in templates", "fix scene.json across templates", or any batch modification to the scene template repositories.
---

# Scene Template Repos

## When to use

Apply this skill when:

- A change needs to be applied across some or all scene template repositories
- A new template repo needs to be cloned or set up locally
- Inspecting or modifying `scene.json` or other files in the template repos

## Template Repositories

There are 12 scene template repos. The blank scene lives in the `decentraland` org; the rest live in the `decentraland-scenes` org.

| #   | Repo name                | GitHub org          | Description                          |
| --- | ------------------------ | ------------------- | ------------------------------------ |
| 1   | sdk-empty-scene-template | decentraland        | Blank/empty scene (default template) |
| 2   | teamhub-library          | decentraland-scenes | Team Hub Template                    |
| 3   | stream-studio-template   | decentraland-scenes | Streaming Studio                     |
| 4   | Party-Pad-Template       | decentraland-scenes | Party Pad                            |
| 5   | Spooky-House-Template    | decentraland-scenes | Spooky House                         |
| 6   | cozy-house-template      | decentraland-scenes | Cozy House                           |
| 7   | art-gallery-template     | decentraland-scenes | Art Gallery                          |
| 8   | store-template-scene     | decentraland-scenes | Store                                |
| 9   | Nightclub-template       | decentraland-scenes | Nightclub                            |
| 10  | Streaming-Theatre        | decentraland-scenes | Streaming Theatre                    |
| 11  | mansion-template-scene   | decentraland-scenes | Mansion                              |
| 12  | Video-Streaming-Template | decentraland-scenes | Video Streaming                      |

The blank scene repo is referenced in the Creator Hub codebase at `packages/creator-hub/preload/src/modules/constants.ts` as `EMPTY_SCENE_TEMPLATE_REPO`. The other 11 templates are fetched dynamically from the API at `https://studios.decentraland.org/api/get/resources` filtered by `scene_type` containing "Scene template".

## Local directory convention

Create a `scene-templates/` folder as a sibling to this repo (i.e. in the same parent directory where `creator-hub` lives). For example, if `creator-hub` is at `~/Documents/decentraland/creator-hub`, clone into `~/Documents/decentraland/scene-templates/`:

```
~/Documents/decentraland/scene-templates/
├── sdk-empty-scene-template/
├── teamhub-library/
├── stream-studio-template/
├── Party-Pad-Template/
├── Spooky-House-Template/
├── cozy-house-template/
├── art-gallery-template/
├── store-template-scene/
├── Nightclub-template/
├── Streaming-Theatre/
├── mansion-template-scene/
└── Video-Streaming-Template/
```

## Validating the template list

Before cloning or applying changes, always verify the current list of templates by fetching from the API:

```bash
curl -s "https://studios.decentraland.org/api/get/resources" | jq '[.[] | select(.scene_type | test("Scene template")) | {title, github_link}]'
```

Compare the returned `github_link` values against the table above. If templates have been added, removed, or their repos changed, inform the user and update the workflow accordingly. The blank scene (`sdk-empty-scene-template`) is not returned by this API — it is hardcoded in the Creator Hub codebase.

## Cloning

Always use SSH remotes. To clone all repos:

```bash
cd ~/Documents/decentraland/scene-templates
git clone git@github.com:decentraland/sdk-empty-scene-template.git
git clone git@github.com:decentraland-scenes/teamhub-library.git
git clone git@github.com:decentraland-scenes/stream-studio-template.git
git clone git@github.com:decentraland-scenes/Party-Pad-Template.git
git clone git@github.com:decentraland-scenes/Spooky-House-Template.git
git clone git@github.com:decentraland-scenes/cozy-house-template.git
git clone git@github.com:decentraland-scenes/art-gallery-template.git
git clone git@github.com:decentraland-scenes/store-template-scene.git
git clone git@github.com:decentraland-scenes/Nightclub-template.git
git clone git@github.com:decentraland-scenes/Streaming-Theatre.git
git clone git@github.com:decentraland-scenes/mansion-template-scene.git
git clone git@github.com:decentraland-scenes/Video-Streaming-Template.git
```

If repos are already cloned, verify remotes use SSH (`git@github.com:`) not HTTPS. Switch with:

```bash
git remote set-url origin git@github.com:<org>/<repo>.git
```

## Batch change workflow

To apply the same change across all (or a subset of) template repos:

1. **Read first** — Read the target file (e.g. `scene.json`) from each repo to understand current state and identify which repos need changes.
2. **Detect default branch** — Not all repos use `main`. Detect the default branch for each repo before branching:
   ```bash
   git remote show origin | sed -n 's/.*HEAD branch: //p'
   ```
   Use the result to checkout and pull the correct base branch.
3. **Branch** — Create the same branch name in each repo (e.g. `fix/default-sp-name`). Ensure the repo is on the detected default branch and up to date (`git pull`) before branching.
4. **Edit** — Apply the change using the Edit tool. Process repos in parallel where possible.
5. **Commit** — Use the exact commit message provided by the user. Do not add `Co-Authored-By` lines unless explicitly requested.
6. **Push** — Push with `-u origin <branch>` to set up tracking. Process pushes in parallel.
7. **Create PRs** — If the user requests PRs, create them in batch using `gh pr create`. Use the same title and body across all repos. Process in parallel:
   ```bash
   cd <repo-dir> && gh pr create --title "<title>" --body "<body>"
   ```
   Include the PR URLs in the final report. Do not create PRs unless the user explicitly asks.
8. **Report** — Provide a summary table showing each repo, the old value, and the status (pushed/failed/PR created).

Maximize parallelism: read all files in parallel, create all branches in parallel, edit all files in parallel, commit all repos in parallel, push all repos in parallel.

## Important notes

- Always confirm SSH access before pushing. If push fails with permission denied, inform the user and wait for them to resolve access.
- The `cozy-house-template` repo has been renamed on GitHub to `Cozy-House-Template` but the local clone may still use the lowercase name. Git will warn about the redirect; this is safe to ignore.
- Do not add `Co-Authored-By` trailer to commits unless the user explicitly asks for it.
- When the user says "commit message" they mean the exact message — use it verbatim.
