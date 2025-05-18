<p align="center">
  <img src="./public/images/tstwo.png" alt="TStwo Logo" width="60%">
</p>

<p align="center">
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT"></a>
  <a href="https://github.com/teddyjfpender/tstwo/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/teddyjfpender/tstwo/ci.yml?branch=main" alt="Build Status"></a>
</p>

[Stwo](https://github.com/starkware-libs/stwo/) re-written in TypeScript, by AI.

## Structure

- `packages/app`: Main application
- `packages/core`: Shared utilities and core functionality

## Getting Started

```bash
# Install dependencies
bun install

# Run development
bun dev

# Build all packages
bun build

# Run tests
bun test
```

## Working with packages

You can run commands for specific packages:

```bash
# Run only the app in dev mode
bun --cwd packages/app dev

# Build only the core package
bun --cwd packages/core build
```

This project was created using `bun init` in bun v1.2.13. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.
