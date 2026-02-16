# Decentraland Creator Hub Monorepo

[![CI Status](https://github.com/decentraland/creator-hub/workflows/CI/badge.svg)](https://github.com/decentraland/creator-hub/actions/workflows/ci.yml) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE) [![Node Version](https://img.shields.io/badge/node-%3E%3D22.x-brightgreen.svg)](https://nodejs.org/) [![Made for Decentraland](https://img.shields.io/badge/Made%20for-Decentraland-ff0099.svg)](https://decentraland.org/)

## Table of Contents

- [🏗️ Project Structure](#️-project-structure)
- [🚀 Quick Start](#-quick-start)
  - [Prerequisites](#prerequisites)
  - [Initial Setup](#initial-setup)
- [📋 Makefile Commands](#-makefile-commands)
  - [Setup Commands](#setup-commands)
  - [Build Commands](#build-commands)
  - [Development Commands](#development-commands)
  - [Dependency Management](#dependency-management)
  - [Cleanup Commands](#cleanup-commands)
- [🔧 Package Scripts](#-package-scripts)
  - [Asset Packs Scripts](#asset-packs-scripts)
  - [Inspector Scripts](#inspector-scripts)
  - [Creator Hub Scripts](#creator-hub-scripts)
- [🔄 CI/CD Workflow](#-cicd-workflow)
  - [Main CI Workflow (ci.yml)](#main-ci-workflow-ciyml)
  - [Test Workflow (tests.yml)](#test-workflow-testsyml)
  - [Asset Packs Workflow (asset-packs.yml)](#asset-packs-workflow-asset-packsyml)
  - [Inspector Workflow (inspector.yml)](#inspector-workflow-inspectoryml)
  - [Creator Hub Workflow (creator-hub.yml)](#creator-hub-workflow-creator-hubyml)
- [🏗️ Architecture](#️-architecture)
  - [Monorepo Structure](#monorepo-structure)
  - [Dependency Management](#dependency-management-1)
  - [Protocol Buffers](#protocol-buffers)
- [🧪 Testing](#-testing)
  - [Unit Tests](#unit-tests)
  - [End-to-End Tests](#end-to-end-tests)
  - [Test Structure](#test-structure)
- [🚀 Development Workflow](#-development-workflow)
  - [Typical Development Flow](#typical-development-flow)
  - [Local Development with Asset Packs](#local-development-with-asset-packs)
  - [Launch Build Locally](#launch-build-locally)
  - [Code Quality](#code-quality)
- [📦 Publishing](#-publishing)
  - [Asset Packs Package](#asset-packs-package)
  - [Inspector Package](#inspector-package)
  - [Creator Hub App](#creator-hub-app)
  - [Release Strategy](#release-strategy)
  - [Asset Distribution](#asset-distribution)
- [🔧 Troubleshooting](#-troubleshooting)
  - [Common Issues](#common-issues)
  - [Getting Help](#getting-help)
- [🤝 Contributing](#-contributing)
- [📚 Additional Resources](#-additional-resources)
- [📄 License](#-license)

This monorepo contains the Decentraland Creator Hub ecosystem, consisting of three main packages:

- **`@dcl/asset-packs`** - Curated collections of 3D assets and Smart Items for Decentraland scenes
- **`@dcl/inspector`** - A web-based 3D scene inspector for Decentraland
- **`creator-hub`** - An Electron-based desktop application for creating and managing Decentraland scenes

## 🏗️ Project Structure

```
creator-hub/
├── packages/
│   ├── asset-packs/         # Asset packs and Smart Items
│   │   ├── packs/          # Asset pack definitions
│   │   ├── src/            # Runtime library
│   │   ├── scripts/        # Build and upload scripts
│   │   └── bin/            # Built SDK7 runtime
│   ├── inspector/           # Web-based 3D inspector
│   │   ├── src/            # Source code
│   │   ├── public/         # Built assets
│   │   └── test/           # Tests
│   └── creator-hub/         # Electron desktop application
│       ├── main/           # Main Electron process
│       ├── preload/        # Preload scripts
│       ├── renderer/       # React frontend
│       ├── shared/         # Shared utilities
│       ├── devtools-frontend/ # DevTools frontend (git submodule)
│       └── e2e/            # End-to-end tests
├── .github/workflows/       # CI/CD workflows
├── Makefile                # Build and development commands
└── package.json           # Root package configuration
```

## 🚀 Quick Start

### Prerequisites

Before starting, ensure you have the following installed:

- **Node.js** 22.x or higher ([Download](https://nodejs.org/))
- **npm** (comes with Node.js, preferred over yarn)
- **Git** ([Download](https://git-scm.com/downloads))
- **Docker** (optional, required for local asset-packs content server development)

### Initial Setup

1. **Clone the repository with submodules:**

   ```bash
   git clone --recurse-submodules https://github.com/decentraland/creator-hub.git
   cd creator-hub
   ```

   If you already cloned without submodules, initialize them:

   ```bash
   git submodule update --init --recursive
   ```

2. **Install dependencies and initialize the project:**

   ```bash
   make init
   ```

   This command will:

   - Install all dependencies for the monorepo and sub-packages
   - Download and install Protocol Buffers compiler
   - Initialize git submodules (devtools-frontend)
   - Generate TypeScript definitions from `.proto` files
   - Build all packages

## 📋 Makefile Commands

The project uses a Makefile to manage common development tasks:

### Setup Commands

| Command                | Description                                                        |
| ---------------------- | ------------------------------------------------------------------ |
| `make install-all`     | Install dependencies for all packages                              |
| `make install-protoc`  | Download and install Protocol Buffers compiler                     |
| `make init-submodules` | Initialize git submodules (devtools-frontend)                      |
| `make protoc`          | Generate TypeScript definitions from `.proto` files                |
| `make init`            | Complete project initialization (clean + install + protoc + build) |

### Build Commands

| Command                     | Description                                              |
| --------------------------- | -------------------------------------------------------- |
| `make build`                | Build all packages (asset-packs, inspector, creator-hub) |
| `make build-asset-packs`    | Build only the asset-packs package                       |
| `make build-inspector`      | Build only the inspector package                         |
| `make build-creator-hub`    | Build only the creator-hub package                       |
| `make validate-asset-packs` | Validate asset-packs assets                              |
| `make upload-asset-packs`   | Upload asset-packs to content server                     |

### Development Commands

| Command          | Description                           |
| ---------------- | ------------------------------------- |
| `make lint`      | Run ESLint across all packages        |
| `make lint-fix`  | Fix ESLint issues automatically       |
| `make format`    | Format code with Prettier             |
| `make typecheck` | Run TypeScript type checking          |
| `make test`      | Run unit tests for all packages       |
| `make test-e2e`  | Run end-to-end tests for all packages |

### Dependency Management

| Command              | Description                                             |
| -------------------- | ------------------------------------------------------- |
| `make sync-deps`     | Synchronize dependencies across packages using syncpack |
| `make lint-packages` | Check for dependency mismatches                         |

### Cleanup Commands

| Command           | Description                                 |
| ----------------- | ------------------------------------------- |
| `make clean`      | Remove build artifacts and dist folders     |
| `make deep-clean` | Remove all node_modules and generated files |

## 🔧 Package Scripts

### Asset Packs Scripts

```bash
cd packages/asset-packs

# Development
npm run start          # Start SDK7 dev server (port 8001) and watch for changes

# Building
npm run build          # Build all (SDK7 scene, library, catalog)
npm run build:js       # Build SDK7 scene (bin/index.js)
npm run build:lib      # Build TypeScript library
npm run build:catalog  # Generate catalog.json

# Asset Management
npm run validate       # Validate all assets
npm run upload         # Upload assets to content server
npm run download       # Download assets from content server

# Type checking
npm run typecheck      # Type check the library
```

### Inspector Scripts

```bash
cd packages/inspector

# Development
npm run start          # Start in watch mode

# Building
npm run build          # Build the inspector

# Testing
npm run test           # Run unit tests
npm run test:e2e       # Run end-to-end tests

# Type checking
npm run typecheck      # Type check the inspector
```

### Creator Hub Scripts

```bash
cd packages/creator-hub

# Development
npm run start          # Start in watch mode

# Building
npm run build          # Build all parts (main, preload, renderer)
npm run build:main     # Build main process
npm run build:preload  # Build preload scripts
npm run build:renderer # Build renderer (React app)

# Testing
npm run test           # Run all tests
npm run test:e2e       # Run end-to-end tests
npm run test:unit      # Run unit tests

# Type checking
npm run typecheck      # Type check all parts
```

## 🔄 CI/CD Workflow

The project uses GitHub Actions with a sophisticated CI/CD pipeline:

### Main CI Workflow (`ci.yml`)

The main workflow orchestrates all CI processes and runs on:

- Push to `main` branch
- Pull requests

**Workflow Steps:**

1. **Lint** - Code formatting and linting
2. **Typechecking** - TypeScript type checking
3. **Tests** - Unit and end-to-end tests
4. **Drop Pre-release** - Create pre-release artifacts
5. **Asset Packs Build** - Build, validate, and publish asset-packs package
6. **Inspector Build** - Build and publish inspector package (depends on asset-packs)
7. **Creator Hub Build** - Build and publish creator hub

### Test Workflow (`tests.yml`)

Runs comprehensive testing:

- **Unit Tests** - Runs on Ubuntu with Node.js 22
- **E2E Tests** - Runs on macOS and Windows with Playwright
- **Cross-platform Testing** - Tests both packages

### Asset Packs Workflow (`asset-packs.yml`)

Handles asset-packs package deployment:

- Validates all assets
- Builds the asset-packs package
- Publishes to npm (main branch only)
- Uploads assets to S3 CDN (dev and prod environments)
- Creates GitHub releases with release notes

### Inspector Workflow (`inspector.yml`)

Handles inspector package deployment:

- Builds the inspector package (depends on asset-packs)
- Publishes to S3 for branch previews
- Deploys to GitHub Pages
- Publishes to npm (main branch only)
- Creates GitHub releases with release notes

### Creator Hub Workflow (`creator-hub.yml`)

Handles desktop application builds:

- **Multi-platform Builds** - macOS and Windows
- **Code Signing** - Automatic code signing for both platforms
- **Notarization** - macOS notarization
- **Artifact Distribution** - Uploads to S3 and GitHub releases
- **PR Testing** - Provides download links for PR testing

## 🏗️ Architecture

### Monorepo Structure

The project uses npm workspaces to manage the monorepo:

```json
{
  "workspaces": ["packages/*"]
}
```

### Dependency Management

- **syncpack** is used to synchronize dependencies across packages
- Shared dependencies are defined in the root `package.json`
- Package-specific dependencies are in each package's `package.json`
- The `@dcl/inspector` dependency is managed specially in `.syncpackrc.json`

### Protocol Buffers

The Inspector package uses Protocol Buffers for data layer communication:

- `.proto` files are in `packages/inspector/src/lib/data-layer/proto/`
- Generated TypeScript files are in `packages/inspector/src/lib/data-layer/proto/gen/`
- Use `make protoc` to regenerate after `.proto` changes

## 🧪 Testing

### Unit Tests

- **Creator Hub**: Uses Vitest for main, preload, renderer, and shared tests
- **Inspector**: Uses Vitest for unit tests
- Run with `make test` or `npm run test` in individual packages

### End-to-End Tests

- **Creator Hub**: Uses Playwright for Electron app testing
- **Inspector**: Uses Playwright for web app testing
- Run with `make test-e2e`
- Tests automatically build the applications before running

### Test Structure

```
packages/creator-hub/e2e/          # Creator Hub E2E tests
packages/inspector/test/e2e/       # Inspector E2E tests
```

## 🚀 Development Workflow

### Typical Development Flow

1. **Start Development:**

   ```bash
   make init                    # Initial setup
   cd packages/creator-hub
   npm run start               # Start creator hub in watch mode
   ```

2. **In another terminal:**

   ```bash
   cd packages/inspector
   npm run start               # Start inspector in watch mode
   ```

3. **Before Committing:**
   - Lint, format & typecheck will be run automatically

### Local Development with Asset Packs

To develop with local asset-packs integration (for testing new assets or Smart Items):

1. **Initial setup:**

   ```bash
   make init  # Sets up entire monorepo
   ```

2. **Start asset-packs SDK7 dev server:**

   ```bash
   cd packages/asset-packs
   npm run start  # Starts SDK7 server on port 8001
   ```

3. **In another terminal, start docker content server:**

   ```bash
   cd packages/asset-packs
   docker-compose up  # Starts content server on port 9000
   ```

4. **In another terminal, upload assets to local content server:**

   ```bash
   cd packages/asset-packs
   npm run upload  # Uploads assets to http://localhost:9000
   ```

5. **In another terminal, start inspector dev server:**

   ```bash
   cd packages/inspector
   npm start  # Starts on port 8000
   ```

6. **In another terminal, start Creator Hub:**

   ```bash
   cd packages/creator-hub
   cp .env.example .env  # First time only
   # Edit .env and update VITE_ASSET_PACKS_JS_PATH with your absolute path
   npm start  # Starts on default port
   ```

7. **Configure environment variables in `packages/creator-hub/.env`:**
   ```bash
   VITE_INSPECTOR_PORT=8000
   VITE_ASSET_PACKS_CONTENT_URL=http://localhost:9000/asset-packs
   VITE_ASSET_PACKS_JS_PORT=8001
   VITE_ASSET_PACKS_JS_PATH=/absolute/path/to/creators-hub/packages/asset-packs/bin/index.js
   ```

Now Creator Hub will use:

- Local inspector on port 8000
- Local asset-packs SDK7 runtime on port 8001
- Local content server for assets on port 9000

For inspector-only development with local asset-packs, see [Inspector README](packages/inspector/README.md#local-development-with-asset-packs).

### Launch Build Locally

To launch build locally on macOS, you may need to remove quarantine attributes:

```bash
xattr -c /Applications/Decentraland\ Creator\ Hub.app/
```

**Note**: This command is necessary on macOS to bypass Gatekeeper when running locally built versions. This issue doesn't occur with officially signed releases.

### Code Quality

- **ESLint** - Code linting with custom rules
- **Prettier** - Code formatting
- **TypeScript** - Static type checking
- **syncpack** - Dependency synchronization

## 📦 Publishing

### Asset Packs Package

- Automatically published to npm on main branch
- Assets uploaded to prod S3 CDN on main branch
- PR builds available for testing (npm package only)
- **Dev CDN uploads**: Triggered manually by org members commenting `/upload-assets` on PRs
- **GitHub Releases**: Always marked as pre-releases to avoid confusion with electron-updater

### Inspector Package

- Automatically published to npm on main branch
- PR builds available for testing
- GitHub Pages deployment for web previews
- **GitHub Releases**: Always marked as pre-releases to avoid confusion with electron-updater

### Creator Hub App

- Multi-platform builds (macOS, Windows)
- Code signed and notarized
- Distributed via GitHub releases and S3
- PR builds available for testing
- **GitHub Releases**: Always marked as pre-releases for later manual release when updated to "latest"

### Release Strategy

The project uses a specific release strategy to ensure electron-updater works correctly:

- **Creator Hub releases** are created as pre-release and when ready, they should be marked as "latest" on GitHub, allowing the Electron app to automatically detect and download updates
- **Other packages (Asset Packs, Inspector)** are ALWAYS marked as pre-releases to prevent electron-updater from accidentally downloading the wrong package type
- This separation ensures that users only get Creator Hub app updates through the auto-update mechanism

### Asset Distribution

Asset Packs follows a controlled deployment model:

**Production CDN:**

- Every merge to `main` automatically uploads assets to prod S3 CDN
- Prod CDN: `https://builder-items.decentraland.org/contents/:hash`
- Assets are immediately available after merging, matching the npm package release cycle

**Development CDN:**

- Dev uploads are triggered manually by commenting `/upload-assets` on a PR
- Only organization members can trigger uploads
- Dev CDN: `https://builder-items.decentraland.zone/contents/:hash`
- This prevents conflicts between multiple PRs and reduces unnecessary CI runs
- Assets are content-addressed (hashed), ensuring immutability and cache correctness

## 🔧 Troubleshooting

### Common Issues

#### Port Conflicts

If you encounter errors about ports already in use:

```bash
# Check what's using a port (macOS/Linux)
lsof -i :8000  # Inspector default port
lsof -i :8001  # Asset packs dev server
lsof -i :9000  # Content server

# On Windows (PowerShell)
netstat -ano | findstr :8000
```

**Solution**: Either stop the conflicting process or configure different ports via environment variables.

#### Permission Errors

**macOS Gatekeeper Issues**:

```bash
xattr -c /Applications/Decentraland\ Creator\ Hub.app/
```

**npm Permission Errors**:

```bash
# Don't use sudo! Instead, fix npm permissions:
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
# Add to PATH: export PATH=~/.npm-global/bin:$PATH
```

#### Build Failures

**Clean and Rebuild**:

```bash
make deep-clean  # Remove all node_modules and build artifacts
make init        # Fresh install and build
```

**Protocol Buffer Issues**:

```bash
make install-protoc  # Reinstall protoc
make protoc          # Regenerate proto files
```

**Node Version Mismatch**:

```bash
node --version  # Should be 22.x or higher
```

Use [nvm](https://github.com/nvm-sh/nvm) to manage Node.js versions:

```bash
nvm install 22
nvm use 22
```

#### Docker Issues (Asset Packs)

**Docker Not Running**:

```bash
# Ensure Docker Desktop is running
docker ps  # Should list containers without error
```

**Port 9000 Already in Use**:

```bash
# Change the port in docker-compose.yml or stop the conflicting service
docker-compose down
```

#### Development Server Issues

**Inspector Not Loading**:

- Verify WebSocket URL is correct
- Check browser console for errors
- Ensure CLI server is running with `--data-layer` flag

**Asset Packs Not Showing**:

- Verify `VITE_ASSET_PACKS_CONTENT_URL` is set correctly
- Check that assets were uploaded to the content server
- Clear browser cache

**Hot Reload Not Working**:

```bash
# Restart the development server
# If using multiple terminals, restart all dev servers
```

#### TypeScript Errors

**Type Errors After Update**:

```bash
make typecheck  # Check all packages
npm run typecheck --workspace=packages/inspector  # Specific package
```

**Missing Types**:

```bash
npm install --save-dev @types/package-name
```

### Getting Help

If you're still experiencing issues:

1. **Search Existing Issues**: [GitHub Issues](https://github.com/decentraland/creator-hub/issues)
2. **Ask the Community**: [Decentraland Discord](https://dcl.gg/discord)
3. **Create a New Issue**: Use our [bug report template](https://github.com/decentraland/creator-hub/issues/new)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

For detailed contribution guidelines, see [CONTRIBUTING.md](CONTRIBUTING.md).

The CI pipeline will automatically:

- Lint, format & typecheck
- Run all tests
- Build all packages
- Provide testing artifacts for review
- Deploy preview versions

## 📚 Additional Resources

- [Asset Packs Documentation](packages/asset-packs/README.md)
- [Inspector Documentation](packages/inspector/README.md)
- [Creator Hub Documentation](packages/creator-hub/README.md)
- [Contributing Guidelines](CONTRIBUTING.md)
- [Decentraland Documentation](https://docs.decentraland.org/)

## 📄 License

This monorepo contains multiple packages with different licenses:

- **Root & Creator Hub**: [MIT License](LICENSE)
- **@dcl/inspector**: Apache License 2.0
- **@dcl/asset-packs**: ISC License

See individual package directories for specific license details.

---

Made with ❤️ by the Decentraland community
