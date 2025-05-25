import { M31 } from "../../fields/m31";
import { QM31 } from "../../fields/qm31";

/**
 * Number of elements in a very packed vector.
 */
export const N_VERY_PACKED_ELEMS = 32;

/**
 * Very packed base field for high-density storage.
 */
export class VeryPackedBaseField {
  private data: M31[];

  constructor(data: M31[]) {
    if (data.length !== N_VERY_PACKED_ELEMS) {
      throw new Error(`VeryPackedBaseField requires exactly ${N_VERY_PACKED_ELEMS} elements`);
    }
    this.data = [...data];
  }

  static zero(): VeryPackedBaseField {
    return new VeryPackedBaseField(Array(N_VERY_PACKED_ELEMS).fill(M31.zero()));
  }

  toArray(): M31[] {
    return [...this.data];
  }
}

/**
 * Very packed QM31 field.
 */
export class VeryPackedQM31 {
  private data: QM31[];

  constructor(data: QM31[]) {
    if (data.length !== N_VERY_PACKED_ELEMS) {
      throw new Error(`VeryPackedQM31 requires exactly ${N_VERY_PACKED_ELEMS} elements`);
    }
    this.data = [...data];
  }

  static zero(): VeryPackedQM31 {
    return new VeryPackedQM31(Array(N_VERY_PACKED_ELEMS).fill(QM31.zero()));
  }

  toArray(): QM31[] {
    return [...this.data];
  }
}

/**
 * Type alias for very packed secure field.
 */
export type VeryPackedSecureField = VeryPackedQM31; 