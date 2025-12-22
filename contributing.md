# Contributing to Decentraland Creator Hub

Thank you for your interest in contributing to the Decentraland Creator Hub! This document provides guidelines and instructions for contributing to this monorepo.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Commit Message Guidelines](#commit-message-guidelines)
- [Testing Guidelines](#testing-guidelines)
- [Reporting Bugs](#reporting-bugs)
- [Suggesting Features](#suggesting-features)
- [Community](#community)

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment. We expect all contributors to:

- Be respectful and inclusive in language and actions
- Accept constructive criticism gracefully
- Focus on what's best for the community
- Show empathy towards other community members

## Getting Started

### Prerequisites

Before contributing, ensure you have:

- **Node.js** 22.x or higher
- **npm** (comes with Node.js)
- **Git** installed and configured
- **Docker** (optional, for asset-packs development)
- Familiarity with TypeScript, React, and Electron (depending on the package)

### Initial Setup

1. **Fork the repository** on GitHub

2. **Clone your fork**:
   \`\`\`bash
   git clone git@github.com:YOUR_USERNAME/creator-hub.git
   cd creator-hub
   \`\`\`

3. **Add upstream remote**:
   \`\`\`bash
   git remote add upstream git@github.com:decentraland/creator-hub.git
   \`\`\`

4. **Install dependencies and build**:
   \`\`\`bash
   make init
   \`\`\`

5. **Verify everything works**:
   \`\`\`bash
   make test
   \`\`\`

## Development Workflow

### Working on a Feature or Bug Fix

1. **Sync with upstream**:
   \`\`\`bash
   git checkout main
   git fetch upstream
   git merge upstream/main
   \`\`\`

2. **Create a feature branch**:
   \`\`\`bash
   git checkout -b feat/your-feature-name
   # or
   git checkout -b fix/your-bug-fix
   \`\`\`

3. **Make your changes**:
   - Follow the [coding standards](#coding-standards)
   - Write tests for new functionality
   - Update documentation as needed

4. **Run quality checks**:
   \`\`\`bash
   make lint           # Check code style
   make typecheck      # TypeScript type checking
   make test           # Run unit tests
   make test-e2e       # Run E2E tests (optional but recommended)
   \`\`\`

5. **Fix any issues**:
   \`\`\`bash
   make lint-fix       # Auto-fix linting issues
   npm run format:fix  # Auto-format code
   \`\`\`

6. **Commit your changes** (see [commit guidelines](#commit-message-guidelines))

7. **Push to your fork**:
   \`\`\`bash
   git push origin feat/your-feature-name
   \`\`\`

8. **Create a Pull Request** on GitHub

### Package-Specific Development

#### Asset Packs
\`\`\`bash
cd packages/asset-packs
npm run start          # Start dev server
npm run validate       # Validate assets
npm run build          # Build package
\`\`\`

#### Inspector
\`\`\`bash
cd packages/inspector
npm start              # Start dev server (port 8000)
npm run test           # Run tests
npm run build          # Build package
\`\`\`

#### Creator Hub
\`\`\`bash
cd packages/creator-hub
npm start              # Start in watch mode
npm run test           # Run all tests
npm run compile        # Compile distributable
\`\`\`

## Pull Request Process

### Before Submitting

- [ ] Ensure all tests pass (\`make test\`)
- [ ] Run linting and type checking (\`make lint && make typecheck\`)
- [ ] Update documentation if needed
- [ ] Add tests for new features
- [ ] Rebase on latest \`main\` if needed

### PR Requirements

1. **Clear Title**: Use descriptive titles following the commit convention
   - \`feat: add support for custom assets\`
   - \`fix: resolve scene loading issue\`
   - \`docs: update installation guide\`

2. **Description**: Include:
   - What changes were made and why
   - Related issue number (e.g., "Fixes #123")
   - Screenshots/videos for UI changes
   - Breaking changes (if any)

3. **Small PRs**: Keep PRs focused and reasonably sized
   - One feature/fix per PR
   - Split large changes into multiple PRs

4. **Review Process**:
   - Wait for CI checks to pass
   - Address review feedback promptly
   - Request re-review after making changes

### PR Labels

Our team will add appropriate labels:
- \`bug\` - Bug fixes
- \`enhancement\` - New features
- \`documentation\` - Documentation updates
- \`dependencies\` - Dependency updates
- \`breaking-change\` - Breaking changes

## Coding Standards

### TypeScript/JavaScript

- **Use TypeScript** for all new code
- **Follow ESLint rules** configured in the project
- **Use strict mode**: Avoid \`any\` types when possible
- **Prefer functional programming**: Use \`const\`, arrow functions, immutability
- **Use modern ES6+ features**: async/await, destructuring, spread operators

### File Organization

\`\`\`
src/
├── components/      # React components
├── lib/            # Utility libraries
├── hooks/          # React hooks
├── types/          # TypeScript type definitions
└── tests/          # Test files (*.spec.ts, *.test.ts)
\`\`\`

### Naming Conventions

- **Files**: \`kebab-case.ts\` or \`PascalCase.tsx\` for React components
- **Variables/Functions**: \`camelCase\`
- **Classes/Components**: \`PascalCase\`
- **Constants**: \`UPPER_SNAKE_CASE\`
- **Private members**: Prefix with \`_\` (e.g., \`_privateMethod\`)

### React Best Practices

- Use functional components and hooks
- Use TypeScript for prop types
- Keep components small and focused
- Extract reusable logic into custom hooks
- Memoize expensive computations with \`useMemo\`/\`useCallback\`

### Code Comments

- Write self-documenting code (clear variable/function names)
- Add comments for complex logic or non-obvious decisions
- Use JSDoc for public APIs
- Avoid redundant comments that just restate the code

## Commit Message Guidelines

We follow **semantic commit messages** to automatically generate changelogs and determine version bumps.

### Format

\`\`\`
<type>: <subject>

[optional body]

[optional footer]
\`\`\`

### Types

- **feat**: New feature (triggers minor version bump)
- **fix**: Bug fix (triggers patch version bump)
- **docs**: Documentation changes
- **style**: Code style changes (formatting, semicolons, etc.)
- **refactor**: Code refactoring without feature changes
- **perf**: Performance improvements
- **test**: Adding or updating tests
- **chore**: Build process, tooling, dependencies
- **breaking**: Breaking changes (triggers major version bump)

### Examples

\`\`\`bash
feat: add drag-and-drop support for assets

fix: resolve memory leak in scene preview

docs: update contribution guidelines

breaking: remove deprecated API methods
\`\`\`

### Multi-line Commits

For complex changes, add details in the body:

\`\`\`bash
feat: implement Smart Item parameter validation

- Add schema validation for Smart Item configurations
- Display user-friendly error messages
- Add unit tests for validation logic

Closes #456
\`\`\`

## Testing Guidelines

### Unit Tests

- Write tests for all new features and bug fixes
- Use **Vitest** for unit testing
- Aim for high code coverage (target: 80%+)
- Test edge cases and error conditions
- Mock external dependencies

#### Example Test

\`\`\`typescript
import { describe, it, expect } from 'vitest'
import { myFunction } from './myFunction'

describe('myFunction', () => {
  it('should return expected result', () => {
    const result = myFunction('input')
    expect(result).toBe('expected')
  })

  it('should handle edge cases', () => {
    expect(() => myFunction(null)).toThrow()
  })
})
\`\`\`

### E2E Tests

- Use **Playwright** for end-to-end testing
- Test critical user workflows
- Run locally before submitting PR: \`make test-e2e\`
- E2E tests run automatically in CI on macOS and Windows

### Running Tests

\`\`\`bash
# All tests
make test

# Specific package
cd packages/inspector
npm run test

# Watch mode
npm run test -- --watch

# E2E tests
make test-e2e
\`\`\`

## Reporting Bugs

### Before Reporting

1. **Search existing issues** to avoid duplicates
2. **Test on latest version** from \`main\` branch
3. **Gather information**:
   - Operating system and version
   - Node.js version
   - Steps to reproduce
   - Expected vs actual behavior
   - Error messages and logs

### Creating a Bug Report

Use the **Bug Report** issue template and include:

- **Clear title**: Describe the issue concisely
- **Description**: What happened vs what should happen
- **Reproduction steps**: Numbered list to reproduce
- **Screenshots/videos**: If applicable
- **Environment**:
  \`\`\`
  - OS: macOS 14.0
  - Node: 22.1.0
  - Package: creator-hub
  - Version: 1.2.3
  \`\`\`
- **Logs**: Include relevant error logs
  - macOS: \`~/Library/Logs/creator-hub/main.log\`
  - Windows: \`%APPDATA%\\creator-hub\\logs\\main.log\`

## Suggesting Features

### Before Suggesting

1. **Check existing feature requests** for duplicates
2. **Consider if it aligns** with project goals
3. **Think through the use case** and benefits

### Creating a Feature Request

Use the **Feature Request** issue template and include:

- **Problem statement**: What problem does this solve?
- **Proposed solution**: How should it work?
- **Alternatives considered**: Other approaches you thought about
- **Additional context**: Mockups, examples, references
- **Use cases**: Who benefits and how?

## Community

### Getting Help

- **Discord**: Join the [Decentraland Discord](https://dcl.gg/discord)
- **Forum**: Visit [Decentraland Forums](https://forum.decentraland.org/)
- **Documentation**: Check [Decentraland Docs](https://docs.decentraland.org/)
- **GitHub Discussions**: Ask questions in [Discussions](https://github.com/decentraland/creator-hub/discussions)

### Recognition

Contributors are recognized in:
- Release notes
- GitHub contributors list
- Special mentions for significant contributions

## License

By contributing, you agree that your contributions will be licensed under the same license as the project (MIT License).

---

**Thank you for contributing to Decentraland Creator Hub!** 🎉

Your contributions help make the metaverse more accessible and powerful for creators worldwide.
