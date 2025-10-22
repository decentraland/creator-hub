# Decentraland Creator Hub Monorepo

This monorepo contains the Decentraland Creator Hub ecosystem, consisting of two main packages:

- **`@dcl/inspector`** - A web-based 3D scene inspector for Decentraland
- **`creator-hub`** - An Electron-based desktop application for creating and managing Decentraland scenes

## 🏗️ Project Structure

```
creator-hub/
├── packages/
│   ├── creator-hub/          # Electron desktop application
│   │   ├── main/            # Main Electron process
│   │   ├── preload/         # Preload scripts
│   │   ├── renderer/        # React frontend
│   │   ├── shared/          # Shared utilities
│   │   └── e2e/            # End-to-end tests
│   └── inspector/           # Web-based 3D inspector
│       ├── src/            # Source code
│       ├── public/         # Built assets
│       └── test/           # Tests
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
| `make build` | Build both inspector and creator-hub packages |
| `make build-inspector` | Build only the inspector package |
| `make build-creator-hub` | Build only the creator-hub package |

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
5. **Inspector Build** - Build and publish inspector package
6. **Creator Hub Build** - Build and publish creator hub

### Test Workflow (`tests.yml`)

Runs comprehensive testing:
- **Unit Tests** - Runs on Ubuntu with Node.js 22
- **E2E Tests** - Runs on macOS and Windows with Playwright
- **Cross-platform Testing** - Tests both packages

### Inspector Workflow (`inspector.yml`)

Handles inspector package deployment:
- Builds the inspector package
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
- **Other packages (e.g Inspector releases)** are ALWAYS marked as pre-releases to prevent electron-updater from accidentally downloading the wrong package type
- This separation ensures that users only get Creator Hub app updates through the auto-update mechanism

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

- [Creator Hub Documentation](packages/creator-hub/README.md)
- [Inspector Documentation](packages/inspector/README.md)
- [Contributing Guidelines](CONTRIBUTING.md)
- [Decentraland Documentation](https://docs.decentraland.org/)


change this