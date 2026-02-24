# Asset Packs

[![npm version](https://img.shields.io/npm/v/@dcl/asset-packs.svg)](https://www.npmjs.com/package/@dcl/asset-packs)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)
[![CI Status](https://github.com/decentraland/creator-hub/workflows/Asset%20Packs/badge.svg)](https://github.com/decentraland/creator-hub/actions/workflows/asset-packs.yml)

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
  - [Using Asset Packs in Your Scene](#using-asset-packs-in-your-scene)
  - [Prerequisites for Development](#prerequisites-for-development)
- [Distribution](#distribution)
  - [Production](#production)
  - [Development](#development)
  - [Deployment](#deployment)
  - [Local Development](#local-development)
  - [Troubleshooting](#troubleshooting)
- [Related Architecture Decisions](#related-architecture-decisions)

## Overview

The asset-packs repository is a fundamental component of the Decentraland ecosystem that serves as the central storage and distribution system for default items and assets. It manages and distributes:

- **Asset Packs**: Curated collections of 3D assets organized by themes (cyberpunk, steampunk, genesis city)
- **Static Items**: Basic 3D models with textures and materials
- **Smart Items**: Interactive items with programmable behaviors and configurations

When deployed, all assets are hashed and uploaded to an S3 bucket under `contents/:hash`. An npm package `@dcl/asset-packs` is published containing:

- A `catalog.json` with all asset packs data and content hashes
- A `bin/index.js` runtime required for Smart Items functionality

The assets are accessible through `builder-items.decentraland.*` via Cloudflare.

## Quick Start

### Using Asset Packs in Your Scene

Install the package in your Decentraland SDK7 scene:

```bash
npm install @dcl/asset-packs
```

Import and use asset packs in your scene:

```typescript
import { readGltfLocator } from '@dcl/asset-packs'

// Use an asset from the catalog
const assetId = 'some-asset-id'
const gltfSrc = readGltfLocator(assetId)

// Use in your scene
engine.addEntity({
  transform: Transform.create(),
  gltfContainer: GltfContainer.create({ src: gltfSrc })
})
```

### Prerequisites for Development

- **Node.js** 22.x or higher
- **npm** (comes with Node.js)
- **Docker** (for running local content server)
- **@dcl/sdk-commands** installed globally or locally

## Distribution

### Production

- npm: `@dcl/asset-packs@latest`
- cdn: `https://builder-items.decentraland.org/contents/:hash`

### Development

- npm: `@dcl/asset-packs@next`
- cdn: `https://builder-items.decentraland.zone/contents/:hash`

### Deployment

**Production Deployment:**
- Triggered by: Every merge to the `main` branch
- npm: Publishes `@dcl/asset-packs@latest`
- CDN: Uploads assets to `https://builder-items.decentraland.org`

**Development Deployment:**
- Triggered by: Manual comment `/upload-assets` on pull requests (org members only)
- npm: Test packages available via S3 for PR testing
- CDN: Uploads assets to `https://builder-items.decentraland.zone`

**Note**: All assets are content-addressed (hashed), ensuring immutability and correct caching.

### Local Development

You can develop this repo locally and test it within the Web Editor by doing the following:

Go to this repo in your machine and do this:

1. Run `npm run start` to watch for changes and start the SDK7 dev server (on port `8001` by default).
2. On a new terminal, run `docker-compose up` to start the local content server on `http://localhost:9000/asset-packs`
3. On a new terminal, run `npm run upload` to upload all assets to your local content server (copy the `.env.example` into `.env` if you haven't done that before).
4. Copy the path to the `bin/index.js` in this repo (something like `/Users/my-user/path/to/creators-hub/packages/asset-packs/bin/index.js`).

Go to the `packages/inspector` in this monorepo and do this:

1. Run `npm start` to start a local dev server. It should start by default on port `8000`.

Go to the `packages/creator-hub` in this monorepo and do this:

1. Copy the `.env.example` to `.env` if you haven't done that before.
2. Set the `VITE_INSPECTOR_PORT` env var in `.env` to be `8000` (this is the `@dcl/inspector` dev server we started in the previous section).
3. Set the `VITE_ASSET_PACKS_JS_PORT` to the port where the SDK7 started running in the first section (`8001`).
4. Set the `VITE_ASSET_PACKS_JS_PATH` env var in `.env` to the path to the `bin/index.js` that you copied in the first section.
5. Set the `VITE_ASSET_PACKS_CONTENT_URL` env var in `.env` to be `http://localhost:9000/asset-packs` (this is the content server we started in the first section).
6. Run `npm start` to start the builder local server which should start on port `3000`

Now you are all set, you can start developing the SDK7 scene in this repo, use it from the local Builder and test it by previewing the scene, which should use your local Builder Server serving the development javascript files.

### Testing New Assets in the Inspector

The inspector fetches the asset catalog at runtime from S3. If `latest/catalog.json` is unreachable (e.g. on a pre-merge PR branch, in CI, or offline), it automatically falls back to the `catalog.json` bundled in the `@dcl/asset-packs` npm package — so the inspector always loads.

When you add a **new** asset locally it won't appear in the Asset Packs tab automatically because neither the CDN nor the bundled catalog knows about it yet. There are two options:

#### Option 1 — Docker (full local stack, recommended)

The existing docker-compose setup handles everything. `npm run upload` now also uploads `catalog.json` as `asset-packs/latest/catalog.json` to MinIO, mirroring what CI does on S3.

Follow the steps in [Local Development](#local-development) above, then open the inspector with:

```
http://localhost:8000/?contentUrl=http://localhost:9000/asset-packs
```

Both the catalog listing and all asset files are served locally — full end-to-end testing with no remote CDN needed.

#### Option 2 — Upload to dev CDN via PR

Push your branch and comment `/upload-assets` on the pull request (org members only). The CI will upload all asset files from your branch to the development CDN (`https://builder-items.decentraland.zone`) and post a comment confirming the upload.

Then configure the inspector to use the dev CDN:

```
VITE_ASSET_PACKS_CONTENT_URL=https://builder-items.decentraland.zone
```

Or when opening the inspector directly:

```
http://localhost:8000/?contentUrl=https://builder-items.decentraland.zone
```

The catalog pointer (`latest/catalog.json`) is only updated on merge to `main`, so the Asset Packs tab will still show the currently published catalog — but the asset files themselves will be available for loading.

### Troubleshooting

#### Missing `@dcl/ecs` dependency

This package has a dependency on `@dcl/ecs` for several types. This is package is not added as a dependency even though it should be, because this causes an issue when installing `@dcl/sdk@next` on a scene. The problem is the following dependency chains:

1. `@dcl/sdk` -> `@dcl/ecs`
2. `@dcl/sdk` -> `@dcl/sdk-commands` -> `@dcl/inspector` -> `@dcl/asset-packs` -> `@dcl/ecs`

When a user installs `@dcl/sdk@next` on as scene, that updates `@dcl/ecs` from 1) but not the one from 2) and due to the clash npm stores the `@latest` version on the top level of node_modules and the `@next` version only whithin the `@dcl/sdk/node_modules`. This can cause runtime issues.

So we decisded to remove the explicit dependency of `@dcl/ecs` from the `@dcl/asset-packs` package, and that allows users to install `@dcl/sdk@next` or upgrade versions without problems.
The downside is that if this package is used in some project where `@dcl/ecs` is not available, it's going to break. This package is not meant to be used outside of a Decentraland scene anyway so that shouldn't be a problem.

## Related Architecture Decisions

For a deeper understanding of the architecture and design decisions:

- [ADR-281: Items in Decentraland tooling](https://adr.decentraland.org/adr/ADR-281) - Describes the Items abstraction, types of items (Static, Smart, Custom), and technical implementation details.
