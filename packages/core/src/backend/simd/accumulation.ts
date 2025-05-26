/**
 * SIMD accumulation operations.
 * 1:1 port of rust-reference/core/backend/simd/accumulation.rs
 */

import { PackedQM31 } from "./qm31";
import { N_LANES } from "./m31";
import { QM31 } from "../../fields/qm31";
import { SecureColumnByCoords } from "../../fields/secure_columns";

/**
 * Implementation of AccumulationOps for SimdBackend.
 * Direct port of the Rust implementation.
 */
export class SimdAccumulationOps {
  /**
   * Accumulates one secure column into another using SIMD operations.
   * Direct port of the Rust accumulate function.
   * 
   * Note: This is a simplified version since the packed methods are not yet implemented
   * in SecureColumnByCoords. In the full implementation, this would use packed operations.
   */
  static accumulate(
    column: SecureColumnByCoords,
    other: SecureColumnByCoords
  ): void {
    const len = Math.min(column.len(), other.len());
    for (let i = 0; i < len; i++) {
      const resCoeff = column.at(i).add(other.at(i));
      column.set(i, resCoeff);
    }
  }

  /**
   * Generates the first `n_powers` powers of `felt` using SIMD.
   * Refer to `CpuBackend::generate_secure_powers` for the scalar CPU implementation.
   * Direct port of the Rust generate_secure_powers function.
   */
  static generateSecurePowers(felt: QM31, nPowers: number): QM31[] {
    if (nPowers === 0) {
      return [];
    }

    // Generate the first N_LANES powers using scalar computation
    const baseArray: QM31[] = [];
    let currentPower = QM31.one();
    for (let i = 0; i < Math.min(N_LANES, nPowers); i++) {
      baseArray.push(currentPower);
      currentPower = currentPower.mul(felt);
    }
    
    if (nPowers <= N_LANES) {
      return baseArray.slice(0, nPowers);
    }

    const base = PackedQM31.fromArray(baseArray);
    const step = PackedQM31.broadcast(baseArray[N_LANES - 1]!.mul(felt));
    const size = Math.ceil(nPowers / N_LANES);

    const result: QM31[] = [];
    let acc = base;

    // Collect the next N_LANES powers of `felt` in each iteration
    for (let i = 0; i < size; i++) {
      const currentPowers = acc.toArray();
      
      // Add the powers from this iteration, but don't exceed nPowers
      const remainingPowers = nPowers - result.length;
      const powersToAdd = Math.min(N_LANES, remainingPowers);
      
      for (let j = 0; j < powersToAdd; j++) {
        result.push(currentPowers[j]!);
      }
      
      // Update accumulator for next iteration
      if (result.length < nPowers) {
        acc = acc.mul(step);
      }
    }

    return result;
  }
} 