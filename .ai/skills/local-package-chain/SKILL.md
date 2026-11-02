---
name: local-package-chain
description: Runbook for carrying a local change through the whole Decentraland package chain — @dcl/asset-packs → @dcl/inspector → js-sdk-toolchain (@dcl/sdk-commands) → a scene run by the Creator Hub preview — with local npm tarballs, then swapping them for CI tarballs and npm versions before merge. Use when a change in this monorepo must be seen by sdk-commands or by a running scene, when packing or installing a local inspector/asset-packs build, or when wiring a js-sdk-toolchain PR to an inspector PR.
---

# Local package chain

This runbook gets an unreleased asset-packs or inspector change into a scene that the Creator Hub preview runs. Every agent in `.claude/agents/` that crosses a package boundary follows these steps. Change the procedure here, not in an agent file.

## Why the monorepo links are not enough

Inside this repo, the inspector reaches asset-packs through `file:../asset-packs`, and Creator Hub reaches the inspector through `file:../inspector`. A scene never uses those links:

- Creator Hub runs `sdk-commands` from the **scene's** `node_modules` (`packages/creator-hub/main/src/modules/path.ts` `getBinPath`).
- `@dcl/sdk-commands` pins `@dcl/inspector` to an **exact** npm version, and that inspector brings its own `@dcl/asset-packs`.
- The inspector UI that Creator Hub shows comes from `packages/inspector/public` in dev. That is a different copy from the one inside `sdk-commands`, which serves the data layer, the composite handling, and `runtime-script`.

A scene sees your change only after you replace the inspector inside `sdk-commands`.

## State lives on disk, not in shell variables

Each Bash call starts a fresh shell, and each agent has its own. A variable set in one call is gone by the next, so every step below is one self-contained command that reads its state from disk:

- `.local-packages/env` (gitignored) holds `REPO`, `PKGS`, `TOOLCHAIN`, and `SCENE`. Every step starts by sourcing it.
- Each step finds its input tarball as the **newest** matching file in `.local-packages/`, so it never depends on a name another call made up.
- A step prints the tarball it produced as its last line. If that line is missing, the step failed, whatever the exit code says.

Inside the monorepo, source the file with `. "$(git rev-parse --show-toplevel)/.local-packages/env"`. Outside it (from the toolchain or the scene), use its absolute path, which your handoff gives you.

## Setup

Write the env file once per feature. Substitute the two paths you confirmed with the user:

```bash
REPO=$(git rev-parse --show-toplevel) && mkdir -p "$REPO/.local-packages" && cat > "$REPO/.local-packages/env" <<EOF
REPO=$REPO
PKGS=$REPO/.local-packages
TOOLCHAIN=/abs/path/to/js-sdk-toolchain
SCENE=/abs/path/to/test-scene
EOF
```

To propose a `TOOLCHAIN`, look for an existing checkout. A plain sibling clone sits at `$REPO/../js-sdk-toolchain`. In a worktree layout such as orca's `workspaces/<repo>/<branch>`, look for `$REPO/../../js-sdk-toolchain/*/`. List what you find (`git -C <dir> branch --show-current`) and let the user pick. Their branch work there is theirs, so use a new branch or worktree for this change.

If there's no checkout, ask before you clone one, then install it once with `git clone https://github.com/decentraland/js-sdk-toolchain <path> && make -C <path> install build`.

Every tarball gets a timestamp in its file name. npm records a local tarball's integrity in the lockfile, so rebuilding under the same file name fails with `EINTEGRITY` or serves the old build.

The monorepo packages keep version `0.1.0` in `package.json`, which npm never publishes (published versions are `7.x` for the inspector and `2.x` for asset-packs). So any `0.1.0` you see downstream is a local build.

## 1. Pack asset-packs

Run this for every chain, including an inspector-only change. The inspector tarball must carry an asset-packs tarball, and packing only reads the asset-packs source. `npm pack` ships `dist`, `bin`, and `catalog.json`, so this runs the full build, not just `build:lib`.

```bash
. "$(git rev-parse --show-toplevel)/.local-packages/env" \
  && make -C "$REPO" build-asset-packs \
  && T=$(mktemp -d) && (cd "$REPO/packages/asset-packs" && npm pack --pack-destination "$T") \
  && mv "$T"/*.tgz "$PKGS/dcl-asset-packs-$(date +%Y%m%d%H%M%S).tgz" \
  && ls -t "$PKGS"/dcl-asset-packs-*.tgz | head -1
```

## 2. Pack the inspector

The inspector's `package.json` declares `@dcl/asset-packs` as `file:../asset-packs`, which can't resolve outside this repo. CI rewrites that spec before packing (`.github/workflows/inspector.yml`, step "install asset-packs"). Locally, the step points it at the newest asset-packs tarball for the length of the pack, then always puts it back:

```bash
. "$(git rev-parse --show-toplevel)/.local-packages/env"
AP=$(ls -t "$PKGS"/dcl-asset-packs-*.tgz 2>/dev/null | head -1)
test -n "$AP" || echo "No asset-packs tarball in $PKGS: run step 1 first."
test -n "$AP" && make -C "$REPO" build-inspector && T=$(mktemp -d) \
  && (cd "$REPO/packages/inspector" && npm pkg set "dependencies.@dcl/asset-packs=file:$AP" && npm pack --pack-destination "$T")
PACKED=$?
(cd "$REPO/packages/inspector" && npm pkg set "dependencies.@dcl/asset-packs=file:../asset-packs")
git -C "$REPO" diff --exit-code -- packages/inspector/package.json \
  && test "$PACKED" -eq 0 \
  && mv "$T"/*.tgz "$PKGS/dcl-inspector-$(date +%Y%m%d%H%M%S).tgz" \
  && ls -t "$PKGS"/dcl-inspector-*.tgz | head -1
```

The restore runs whether or not the pack succeeded. If the last line isn't a tarball path, look at what came before it:

- A diff from `git diff` means the restore failed. Fix `package.json` before anything else, because committing it would break the monorepo build.
- No diff means the build or the pack failed. The error is above.

Because the packed inspector carries the asset-packs tarball as its own dependency, the toolchain needs no `overrides` entry.

## 3. Install it into js-sdk-toolchain

```bash
. /abs/path/to/monorepo/.local-packages/env \
  && IN=$(ls -t "$PKGS"/dcl-inspector-*.tgz | head -1) && test -n "$IN" \
  && (cd "$TOOLCHAIN/packages/@dcl/sdk-commands" && npm install --save-exact "$IN") \
  && make -C "$TOOLCHAIN" build \
  && make -C "$TOOLCHAIN" test
```

`make build` runs `make clean` first, and its build script also compiles `sdk-commands`. `make test` is the toolchain's jest suite. Don't run `make update-snapshots` to make a failure go away. A snapshot diff is a behavior change that the toolchain PR has to explain.

<!-- prettier-ignore -->
> [!WARNING]
> Every `@dcl/inspector` from 7.37.0 up to at least the published `7.52.9` fails `make build` in `@dcl/playground-assets`, and fails a scene's `npm run build`, with `ERR_MODULE_NOT_FOUND …/@dcl/ecs-math/dist/Quaternion`. Its `dist/tooling-entrypoint.js` `require`s two inspector devDependencies, `@dcl/ecs-math` and `@babylonjs/core`, which sdk-commands never installs. That's why js-sdk-toolchain still pins `7.36.3`.
>
> The fix is [creator-hub#1675](https://github.com/decentraland/creator-hub/pull/1675), open as of October 12, 2026. With that branch, this whole runbook passes: toolchain build 38/38, scene build, and toolchain tests. Until it merges, build the inspector from a branch that contains it. It's not a linking mistake, so don't change the linking method to work around it. Remove this warning once a published inspector carries the fix.

## 4. Install the toolchain into the scene

This mirrors the toolchain's own `make init-test-scene`. Directory installs create symlinks, so the sdk's `file:../ecs` siblings still resolve, and Creator Hub follows the symlink into your toolchain checkout. The resolution check is the gate, so both lines must print `0.1.0`:

```bash
. /abs/path/to/monorepo/.local-packages/env && cd "$SCENE" \
  && npm install "$TOOLCHAIN/packages/@dcl/sdk" "$TOOLCHAIN/packages/@dcl/sdk-commands" "$TOOLCHAIN/packages/@dcl/js-runtime" \
  && node -p "const {createRequire:c}=require('module');const r=c(require.resolve('@dcl/sdk-commands/package.json',{paths:['.']}));const i=r.resolve('@dcl/inspector/package.json');['inspector '+require(i).version,'asset-packs '+require(c(i).resolve('@dcl/asset-packs/package.json')).version].join('\n')" \
  && npm run build
```

Then open the scene in Creator Hub (`npm run start` in `packages/creator-hub`) and start the preview. When the editor offers to update `@dcl/sdk`, decline it. That prompt comes from the `npm outdated` check in `runProject` (`renderer/src/modules/store/workspace/thunks.ts`), and accepting it reinstalls `@dcl/sdk@latest` over your link.

## 5. Swap to CI tarballs, then npm versions, before merge

Local tarball paths must never reach a pushed `package.json`. Before you push the js-sdk-toolchain branch:

1. Open the monorepo PR first. Its CI posts a "Test @dcl/inspector package" comment with an `npm install "<url>"` line (and an asset-packs one when asset-packs changed). Read it with `gh pr view <number> --comments`.
2. In `$TOOLCHAIN/packages/@dcl/sdk-commands`, run `npm install --save-exact "<inspector tarball url>"`, then `make build test` again.
3. Push the toolchain branch and open its PR. In the body, link the monorepo PR and state that it merges first.
4. After the monorepo PR lands on `main`, CI publishes `@dcl/inspector` to npm under `latest`. Replace the URL with that exact version (`npm install --save-exact @dcl/inspector@<version>`) before the toolchain PR merges.

## Rollback

Each hop undoes cleanly. Source the env file first:

- Inspector `package.json`: `git -C "$REPO" checkout -- packages/inspector/package.json`.
- Toolchain: `git -C "$TOOLCHAIN" checkout -- packages/@dcl/sdk-commands/package.json packages/@dcl/sdk-commands/package-lock.json`, then `npm install` in that folder.
- Scene: `git -C "$SCENE" checkout -- package.json package-lock.json && (cd "$SCENE" && npm install)`.
- Tarballs and env: `rm -rf "$PKGS"`.
