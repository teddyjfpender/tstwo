# TsTwo Repository Guide

## Repository Structure
- This is a TypeScript monorepo using workspaces
- `packages/` contains all project packages:
  - `packages/core/` - Core library
  - `packages/app/` - Application implementation
- Workspace configuration is in the root `package.json`
- TypeScript configuration is in `tsconfig.json`

## Development Environment
- This project uses [Bun](https://bun.sh/) as the package manager and runtime
- Commands are configured to run across all packages in parallel

### Getting Started
```bash
# Install dependencies
bun install

# Start development servers for all packages
bun run dev
```

### Common Commands
- `bun run build` - Build all packages
- `bun run dev` - Start development servers
- `bun run test` - Run tests across all packages
- `bun run lint` - Run linters across all packages

### Working with Individual Packages
```bash
# Run commands for specific packages
bun run --cwd packages/core build
bun run --cwd packages/app dev
```

## Testing and Validation
- Write tests for any new functionality
- Ensure all tests pass before submitting changes: `bun run test`
- Run linting to check code style: `bun run lint`
- The CI workflow will validate:
  - Code builds correctly
  - Tests pass
  - Linting rules are followed

## Contribution Guidelines
- Follow the existing code style and patterns
- Use TypeScript for type safety
- Keep packages modular and focused
- Document public APIs and complex logic
- Update tests when changing functionality

## CI/CD Process
- CI runs on GitHub Actions (see `.github/workflows/ci.yml`)
- CI is triggered on:
  - Pushes to the `main` branch
  - Pull requests targeting the `main` branch
- CI validates:
  - Dependencies installation
  - Linting
  - Building
  - Testing

## PR Instructions
- Title format: `[package-name] Brief description of changes`
- Keep PRs focused on a single objective
- Provide context for your changes in the PR description 