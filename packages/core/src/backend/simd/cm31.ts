import { CM31 } from "../../fields/cm31";
import { PackedM31, N_LANES } from "./m31";

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
   * Creates a one-filled PackedCM31.
   */
  static one(): PackedCM31 {
    return PackedCM31.broadcast(CM31.one());
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

  /**
   * Returns all `a` values (real parts).
   */
  a(): PackedM31 {
    return PackedM31.fromArray(this.data.map(cm31 => cm31.real));
  }

  /**
   * Returns all `b` values (imaginary parts).
   */
  b(): PackedM31 {
    return PackedM31.fromArray(this.data.map(cm31 => cm31.imag));
  }

  /**
   * Addition operation.
   */
  add(other: PackedCM31): PackedCM31 {
    const result = this.data.map((val, i) => val.add(other.data[i]!));
    return new PackedCM31(result);
  }

  /**
   * Subtraction operation.
   */
  sub(other: PackedCM31): PackedCM31 {
    const result = this.data.map((val, i) => val.sub(other.data[i]!));
    return new PackedCM31(result);
  }

  /**
   * Multiplication operation.
   */
  mul(other: PackedCM31): PackedCM31 {
    const result = this.data.map((val, i) => val.mul(other.data[i]!));
    return new PackedCM31(result);
  }

  /**
   * Negation operation.
   */
  neg(): PackedCM31 {
    const result = this.data.map(val => val.neg());
    return new PackedCM31(result);
  }

  /**
   * Scalar addition with PackedM31.
   */
  addPackedM31(rhs: PackedM31): PackedCM31 {
    const rhsArray = rhs.toArray();
    const result = this.data.map((val, i) => val.addM31(rhsArray[i]!));
    return new PackedCM31(result);
  }

  /**
   * Scalar subtraction with PackedM31.
   */
  subPackedM31(rhs: PackedM31): PackedCM31 {
    const rhsArray = rhs.toArray();
    const result = this.data.map((val, i) => val.subM31(rhsArray[i]!));
    return new PackedCM31(result);
  }

  /**
   * Scalar multiplication with PackedM31.
   */
  mulPackedM31(rhs: PackedM31): PackedCM31 {
    const rhsArray = rhs.toArray();
    const result = this.data.map((val, i) => val.mulM31(rhsArray[i]!));
    return new PackedCM31(result);
  }

  /**
   * Interleaves two vectors.
   */
  interleave(other: PackedCM31): [PackedCM31, PackedCM31] {
    const aEvens = this.a();
    const bEvens = this.b();
    const aOdds = other.a();
    const bOdds = other.b();
    
    const [aLhs, aRhs] = aEvens.interleave(aOdds);
    const [bLhs, bRhs] = bEvens.interleave(bOdds);
    
    // Reconstruct CM31 values from real and imaginary parts
    const lhsData: CM31[] = [];
    const rhsData: CM31[] = [];
    
    const aLhsArray = aLhs.toArray();
    const bLhsArray = bLhs.toArray();
    const aRhsArray = aRhs.toArray();
    const bRhsArray = bRhs.toArray();
    
    for (let i = 0; i < N_LANES; i++) {
      lhsData.push(CM31.from_m31(aLhsArray[i]!, bLhsArray[i]!));
      rhsData.push(CM31.from_m31(aRhsArray[i]!, bRhsArray[i]!));
    }
    
    return [new PackedCM31(lhsData), new PackedCM31(rhsData)];
  }

  /**
   * Deinterleaves two vectors.
   */
  deinterleave(other: PackedCM31): [PackedCM31, PackedCM31] {
    const aSelf = this.a();
    const bSelf = this.b();
    const aOther = other.a();
    const bOther = other.b();
    
    const [aEvens, aOdds] = aSelf.deinterleave(aOther);
    const [bEvens, bOdds] = bSelf.deinterleave(bOther);
    
    // Reconstruct CM31 values from real and imaginary parts
    const evensData: CM31[] = [];
    const oddsData: CM31[] = [];
    
    const aEvensArray = aEvens.toArray();
    const bEvensArray = bEvens.toArray();
    const aOddsArray = aOdds.toArray();
    const bOddsArray = bOdds.toArray();
    
    for (let i = 0; i < N_LANES; i++) {
      evensData.push(CM31.from_m31(aEvensArray[i]!, bEvensArray[i]!));
      oddsData.push(CM31.from_m31(aOddsArray[i]!, bOddsArray[i]!));
    }
    
    return [new PackedCM31(evensData), new PackedCM31(oddsData)];
  }

  /**
   * Doubles each element in the vector.
   */
  double(): PackedCM31 {
    return this.add(this);
  }

  /**
   * Computes the inverse of each element.
   */
  inverse(): PackedCM31 {
    const result = this.data.map(val => val.inverse());
    return new PackedCM31(result);
  }

  /**
   * Batch inverse operation.
   */
  static batchInverse(columns: PackedCM31[]): PackedCM31[] {
    // For now, use individual inverses
    // TODO: Implement optimized batch inverse
    return columns.map(col => col.inverse());
  }

  /**
   * Checks if all elements are zero.
   */
  isZero(): boolean {
    return this.data.every(val => val.equals(CM31.zero()));
  }

  /**
   * Checks if this PackedCM31 equals another.
   */
  equals(other: PackedCM31): boolean {
    return this.data.every((val, i) => val.equals(other.data[i]!));
  }
} 