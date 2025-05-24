import type { MerkleOps, MerkleHasher } from './ops'; // Assuming MerkleHasher is Hash-generic
import type { MerkleDecommitment } from './prover'; // Assuming this type exists
import { MerkleProver } from './prover'; // Assuming this class exists
import { MerkleVerifier } from './verifier'; // Corrected: MerkleVerifier is the class
import { M31 as BaseField } from '../fields/m31'; // Adjusted path
import type { HashLike } from './hash'; // For MerkleHasher's Hash type
// CpuBackend and MerkleOps are more complex. For now, assume MerkleProver handles backend logic,
// or that a simple array-based backend is implicit in the TS MerkleProver.

class CpuMerkleOps<H extends HashLike> implements MerkleOps<H> {
  private hasher: MerkleHasher<H>;

  constructor(hasher: MerkleHasher<H>) {
    this.hasher = hasher;
  }

  commitOnLayer(
    logSize: number,
    prevLayer: readonly H[] | undefined,
    columns: readonly (readonly BaseField[])[],
  ): H[] {
    const layerSize = 1 << logSize;
    const newLayer: H[] = [];

    for (let i = 0; i < layerSize; i++) {
      const childrenHashes: [H, H] | undefined = prevLayer
        ? [prevLayer[2 * i], prevLayer[2 * i + 1]]
        : undefined;
      
      const columnValues: BaseField[] = [];
      for (const col of columns) {
        // Ensure the column is long enough for the current logSize.
        // In the Rust MerkleProver, columns are filtered by length for each layer.
        // Here, we assume columns passed to commitOnLayer are already appropriate for this layerSize.
        // The original Rust code: `layer_columns.iter().map(|c| c.at(node_index))`
        // `layer_columns` are those where `column.len().ilog2() == log_size`.
        // So, all columns in `layer_columns` have length `layerSize`.
        columnValues.push(col[i]);
      }
      newLayer.push(this.hasher.hashNode(childrenHashes, columnValues));
    }
    return newLayer;
  }
}

// Simple Seeded PRNG (Linear Congruential Generator)
class SimpleRNG {
  private seed: number;
  private readonly a = 1664525;
  private readonly c = 1013904223;
  private readonly m = 2 ** 32; // 2^32

  constructor(seed: number) {
    this.seed = seed;
  }

  nextInt(): number {
    this.seed = (this.a * this.seed + this.c) % this.m;
    return this.seed;
  }

  // Generates a random integer in [min, max)
  genRange(min: number, max: number): number {
    const range = max - min;
    // Using % range can lead to slight bias if m is not a multiple of range.
    // For test data, this is usually acceptable.
    return min + (this.nextInt() % range);
  }
}

export interface TestData<H extends HashLike> {
  queries: Map<number, number[]>;
  decommitment: MerkleDecommitment<H>; // Adjust H if MerkleDecommitment is not generic over HashLike
  values: BaseField[];
  verifier: MerkleVerifier<H>; // Adjust H if MerkleVerifier is not generic over HashLike
}

export function prepareMerkle<H extends HashLike>(
  hasher: MerkleHasher<H>, // Pass hasher instance
): TestData<H> {
  const N_COLS = 10;
  const N_QUERIES = 3;
  const LOG_SIZE_MIN = 3;
  const LOG_SIZE_MAX = 5; // Range is [MIN, MAX) in genRange, so Rust 3..5 means 3 or 4. Max should be 5.

  const rng = new SimpleRNG(0); // Seed with 0 like in Rust

  const logSizes: number[] = [];
  for (let i = 0; i < N_COLS; i++) {
    logSizes.push(rng.genRange(LOG_SIZE_MIN, LOG_SIZE_MAX));
  }

  const cols: BaseField[][] = logSizes.map((logSize) => {
    const size = 1 << logSize;
    const col: BaseField[] = [];
    for (let i = 0; i < size; i++) {
      // BaseField::from(rng.gen_range(0..(1 << 30)))
      // Max value for M31 is 2^31 - 1. rng.gen_range(0, 2**30)
      col.push(BaseField.from(rng.genRange(0, 1 << 30)));
    }
    return col;
  });

  // The Rust code uses: MerkleProver::<CpuBackend, H>::commit(cols.iter().collect_vec());
  // Assuming MerkleProver.commit takes the columns and the hasher directly.
  // The CpuBackend part in Rust handles how MerkleOps are performed.
  // In TS, this might be part of the Prover or handled by array manipulations directly.

  // NEW CODE: Instantiate CpuMerkleOps and use static MerkleProver.commit
  const merkleOps = new CpuMerkleOps(hasher);
  const commitmentProver = MerkleProver.commit<H>(merkleOps, cols);

  const queries = new Map<number, number[]>();
  // Rust: log_size_range.rev() -> so from LOG_SIZE_MAX - 1 down to LOG_SIZE_MIN
  for (let logSize = LOG_SIZE_MAX - 1; logSize >= LOG_SIZE_MIN; logSize--) {
    const layerQueryCount = 1 << logSize;
    const currentLayerQueries: number[] = [];
    for (let i = 0; i < N_QUERIES; i++) {
      currentLayerQueries.push(rng.genRange(0, layerQueryCount));
    }
    // Sort and dedup
    const sortedUniqueQueries = Array.from(new Set(currentLayerQueries)).sort(
      (a, b) => a - b,
    );
    queries.set(logSize, sortedUniqueQueries);
  }

  // const (values, decommitment) = merkle.decommit(&queries, cols.iter().collect_vec());
  // Assuming prover instance `commitmentProver` has a decommit method.
  // Corrected destructuring from object to array:
  const [values, decommitment] = commitmentProver.decommit(queries, cols);

  // const verifier = MerkleVerifier::new(merkle.root(), log_sizes);
  // Corrected: Use MerkleVerifier as the constructor
  // and commitmentProver has a root() method.
  const verifier = new MerkleVerifier<H>(hasher, commitmentProver.root(), logSizes);

  return {
    queries,
    decommitment,
    values,
    verifier,
  };
}
