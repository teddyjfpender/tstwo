import { CM31 } from "../../fields/cm31";
import { N_LANES } from "./m31";

/**
 * TypeScript implementation of PackedCM31 from Rust.
 * Represents a SIMD vector of CM31 (complex M31) elements.
 */
export class PackedCM31 {
  private data: CM31[];

  constructor(data: CM31[]) {
    if (data.length !== N_LANES) {
      throw new Error(`PackedCM31 requires exactly ${N_LANES} elements, got ${data.length}`);
    }
    this.data = [...data]; // Clone for safety
  }

  /**
   * Constructs a new instance with all vector elements set to `value`.
   */
  static broadcast(value: CM31): PackedCM31 {
    return new PackedCM31(Array(N_LANES).fill(value));
  }

  /**
   * Creates a PackedCM31 from an array of CM31 values.
   */
  static fromArray(values: CM31[]): PackedCM31 {
    if (values.length !== N_LANES) {
      throw new Error(`Expected ${N_LANES} values, got ${values.length}`);
    }
    return new PackedCM31(values);
  }

  /**
   * Converts to an array of CM31 values.
   */
  toArray(): CM31[] {
    return [...this.data];
  }

  /**
   * Creates a zero-filled PackedCM31.
   */
  static zero(): PackedCM31 {
    return PackedCM31.broadcast(CM31.zero());
  }

  /**
   * Gets element at index.
   */
  at(index: number): CM31 {
    if (index < 0 || index >= N_LANES) {
      throw new Error(`Index ${index} out of bounds for PackedCM31`);
    }
    return this.data[index]!;
  }

  /**
   * Sets element at index.
   */
  set(index: number, value: CM31): void {
    if (index < 0 || index >= N_LANES) {
      throw new Error(`Index ${index} out of bounds for PackedCM31`);
    }
    this.data[index] = value;
  }
} 