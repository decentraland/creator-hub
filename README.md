# Decentraland Creator Hub Monorepo

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
│       └── e2e/            # End-to-end tests
├── .github/workflows/       # CI/CD workflows
├── Makefile                # Build and development commands
└── package.json           # Root package configuration
```

## 🚀 Quick Start

### Prerequisites

- **Node.js** 22.x or higher
- **npm** (preferred over yarn)
- **Git**

### Initial Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/decentraland/creator-hub.git
   cd creator-hub
   ```

2. **Install dependencies and initialize the project:**
   ```bash
   make init
   ```

   This command will:
   - Install all dependencies for the monorepo and sub-packages
   - Download and install Protocol Buffers compiler
   - Generate TypeScript definitions from `.proto` files
   - Build all packages

## 📋 Makefile Commands

The project uses a Makefile to manage common development tasks:

### Setup Commands

| Command | Description |
|---------|-------------|
| `make install` | Install dependencies for all packages |
| `make install-protoc` | Download and install Protocol Buffers compiler |
| `make protoc` | Generate TypeScript definitions from `.proto` files |
| `make init` | Complete project initialization (clean + install + protoc + build) |

### Build Commands

| Command | Description |
|---------|-------------|
| `make build` | Build all packages (asset-packs, inspector, creator-hub) |
| `make build-asset-packs` | Build only the asset-packs package |
| `make build-inspector` | Build only the inspector package |
| `make build-creator-hub` | Build only the creator-hub package |
| `make validate-asset-packs` | Validate asset-packs assets |
| `make upload-asset-packs` | Upload asset-packs to content server |

### Development Commands

| Command | Description |
|---------|-------------|
| `make lint` | Run ESLint across all packages |
| `make lint-fix` | Fix ESLint issues automatically |
| `make format` | Format code with Prettier |
| `make typecheck` | Run TypeScript type checking |
| `make test` | Run unit tests for all packages |
| `make test-e2e` | Run end-to-end tests for all packages |

### Dependency Management

| Command | Description |
|---------|-------------|
| `make sync-deps` | Synchronize dependencies across packages using syncpack |
| `make lint-packages` | Check for dependency mismatches |

### Cleanup Commands

| Command | Description |
|---------|-------------|
| `make clean` | Remove build artifacts and dist folders |
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

#### Launch Build Locally

To launch build locally on MacOS first run the command:

```
xattr -c /Applications/Decentraland\ Creator\ Hub.app/
```

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

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

The CI pipeline will automatically:
- Lint, format & typecheck
- Run all tests
- Build both packages
- Provide testing artifacts for review
- Deploy preview versions

## 📚 Additional Resources

- [Asset Packs Documentation](packages/asset-packs/README.md)
- [Inspector Documentation](packages/inspector/README.md)
- [Creator Hub Documentation](packages/creator-hub/README.md)
- [Contributing Guidelines](CONTRIBUTING.md)
- [Decentraland Documentation](https://docs.decentraland.org/)
