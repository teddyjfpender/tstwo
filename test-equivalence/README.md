# Test Equivalence System

This directory contains a comprehensive test vector system to ensure that the TypeScript implementation of the STWO prover matches the Rust reference implementation exactly.

## Overview

The test equivalence system consists of:

1. **Rust Test Vector Generator** (`rust-test-vector-generator/`): A Rust program that generates comprehensive test vectors by exercising the Rust reference implementation
2. **Test Vectors** (`../test-vectors/`): JSON files containing inputs, intermediates, and expected outputs
3. **TypeScript Test Suite** (`fields/`): TypeScript tests that validate the TS implementation against the test vectors

## Architecture

```
test-equivalence/
├── rust-test-vector-generator/     # Rust program to generate test vectors
│   ├── Cargo.toml                  # Dependencies on stwo-prover
│   ├── rust-toolchain.toml         # Nightly Rust version matching stwo
│   └── src/main.rs                 # Test vector generation logic
├── fields/                         # TypeScript test files
│   └── m31.test.ts                 # M31 field test vector validation
└── README.md                       # This file

../test-vectors/                    # Generated test vector JSON files
└── m31-test-vectors.json          # M31 field operation test vectors
```

## M31 Field Test Vectors

The M31 field test vectors cover:

- **Basic Operations**: Addition, multiplication, subtraction, negation (100 random test cases each)
- **Construction Methods**: `from_u32_unchecked`, `from_i32`, `from_u32` with edge cases
- **Reduction Operations**: `partial_reduce` and `reduce` with various input ranges
- **Inverse Operations**: `inverse` and `pow2147483645` functions
- **Slice Operations**: `into_slice` for byte serialization
- **Edge Cases**: Zero, one, `is_zero`, `complex_conjugate`

### Test Vector Format

Each test vector contains:
```json
{
  "operation": "add",
  "inputs": {
    "a": 1921246409,
    "b": 1886093101,
    "test_case": 0
  },
  "intermediates": {},
  "output": 1659855863
}
```

- `operation`: The operation being tested
- `inputs`: Input parameters for the operation
- `intermediates`: Important intermediate values for debugging
- `output`: Expected result

### Large Number Handling

For operations involving large numbers (> 2^53), the test vectors use string representation to avoid JSON precision issues:

```json
{
  "operation": "reduce",
  "inputs": {
    "value": "4611686014132420590"  // String to preserve precision
  },
  "intermediates": {
    "step1": "4611686016279904236",  // Large intermediates as strings
    "step2": "4611686016279904236"
  },
  "output": 2147483628
}
```

## Usage

### Generating New Test Vectors

When the Rust reference implementation changes:

```bash
cd test-equivalence/rust-test-vector-generator
cargo run
```

This will regenerate `../test-vectors/m31-test-vectors.json` with fresh test vectors.

### Running Test Vector Validation

```bash
bun test test-equivalence/fields/m31.test.ts
```

This validates that the TypeScript M31 implementation produces identical results to the Rust reference.

## Extending to Other Fields

To add test vectors for other field types (e.g., QM31, CM31):

1. Add generation functions to `rust-test-vector-generator/src/main.rs`
2. Create corresponding TypeScript test files in `fields/`
3. Follow the same pattern of comprehensive operation coverage

## Benefits

- **Exact Equivalence**: Ensures bit-for-bit compatibility between Rust and TypeScript
- **Regression Detection**: Catches any deviations when either implementation changes
- **Comprehensive Coverage**: Tests edge cases and intermediate values
- **Automated**: Easy to regenerate and validate as code evolves
- **Debugging Support**: Intermediate values help diagnose issues

## Test Statistics

Current M31 test vector coverage:
- **452 total test vectors**
- **100 test cases each** for basic operations (add, mul, sub, neg)
- **Edge cases** for construction, reduction, and special functions
- **Intermediate value validation** for complex operations like `reduce` 