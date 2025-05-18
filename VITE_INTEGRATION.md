# Vite Integration

This repository has been updated to use Vite for building while maintaining Bun for package management, development, and testing.

## Changes Made

1. **Dependencies Added**
   - Added Vite for building
   - Added ESLint for linting

2. **Build Configuration**
   - Added Vite configuration for both packages
   - Created proper build scripts that properly work with CI

3. **Scripts**
   - Updated package.json scripts to use Vite for building
   - Kept Bun for testing
   - Fixed the lint command with ESLint v9 configuration

4. **Testing**
   - Maintained compatibility with Bun's test suite (vitest)
   - Fixed test coverage reporting paths

## Build and Test

To build the project:
```
bun run build
```

To run tests:
```
bun run test
```

To lint the codebase:
```
bun run lint
```

## CI Workflow

The CI workflow has been updated to use the proper commands and ensure all steps work correctly. The workflow now:

1. Installs dependencies with Bun
2. Runs linting
3. Builds the packages using Vite
4. Runs tests using Bun
5. Merges and uploads coverage reports 