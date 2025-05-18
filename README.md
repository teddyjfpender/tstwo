<div align="center">

![TStwo](./public/images/tstwo.png)

<a href="https://github.com/teddyjfpender/tstwo/actions/workflows/ci.yml"><img alt="CI" src="https://img.shields.io/github/actions/workflow/status/teddyjfpender/tstwo/ci.yml?style=for-the-badge" height="30"></a>
<a href="https://codecov.io/gh/teddyjfpender/tstwo"><img src="https://img.shields.io/codecov/c/github/teddyjfpender/tstwo?style=for-the-badge&logo=codecov" height="30"/></a>
<a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-brightgreen.svg?style=for-the-badge" alt="License" height="30"></a>
</div>

<div align="center">
  <h1>TStwo</h1>
</div>

## 🌟 About

TStwo is a TypeScript port of the [Stwo](https://github.com/starkware-libs/stwo) project, built as a Bun monorepo. The project is still under heavy development by AI Agents.

## 🚀 Key Features

- **TypeScript implementation** mirroring the original [Stwo](https://github.com/starkware-libs/stwo) architecture.
- **Monorepo setup** using Bun workspaces for the core library and application packages.
- **Ready to develop** with scripts for building, testing and running locally.

## 📦 Getting Started

```bash
# Install dependencies
bun install

# Start development mode
bun run dev

# Build all packages
bun run build

# Run tests
bun run --cwd packages/core test
bun run --cwd packages/app test
```

## 📚 Working with Packages

```bash
# Run only the app package
bun run --cwd packages/app dev

# Build only the core package
bun run --cwd packages/core build
```

## Porting Status

| Rust Module | TypeScript Path | Notes |
|-------------|-----------------|-------|
| `fields/m31.rs` | `packages/core/src/fields/m31.ts` | ✅ ported |
| `fields/cm31.rs` | `packages/core/src/fields/cm31.ts` | ✅ ported |
| `fields/qm31.rs` | `packages/core/src/fields/qm31.ts` | ✅ ported |
| `poly/utils.rs` | `packages/core/src/poly/utils.ts` | ✅ ported |
| `poly/line.rs` | `packages/core/src/poly/line.ts` | 🔶 partial |
| `poly/circle/mod.rs` | `packages/core/src/poly/circle/` | 🔶 partial |
| `circle.rs` | `packages/core/src/circle.ts` | ❌ unstarted |
| `fft.rs` | `packages/core/src/fft.ts` | ❌ unstarted |
| `fri.rs` | `packages/core/src/fri.ts` | ❌ unstarted |
| `constraints.rs` | `packages/core/src/constraints.ts` | ❌ unstarted |
| `proof_of_work.rs` | `packages/core/src/proof_of_work.ts` | ❌ unstarted |
| `queries.rs` | `packages/core/src/queries.ts` | ❌ unstarted |

The table above is also available in machine-readable form at
`porting_status.json`.

## 📜 License

Released under the MIT license.
