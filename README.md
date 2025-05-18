<div align="center">

![TStwo](./public/images/tstwo.png)

<a href="https://github.com/teddyjfpender/tstwo/actions/workflows/ci.yml"><img alt="CI" src="https://img.shields.io/github/actions/workflow/status/teddyjfpender/tstwo/ci.yml?style=for-the-badge" height="30"></a>
<a href="https://codecov.io/gh/teddyjfpender/tstwo"><img src="https://img.shields.io/codecov/c/github/teddyjfpender/tstwo?style=for-the-badge&logo=codecov" height="30"/></a>
<a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/github/license/teddyjfpender/tstwo.svg?style=for-the-badge" alt="License" height="30"></a>
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

## 📜 License

Released under the MIT license.
