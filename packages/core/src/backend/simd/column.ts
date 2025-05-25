import type { Column } from "../index";
import type { BaseField } from "../../fields/m31";
import type { SecureField } from "../../fields/qm31";
import { M31 } from "../../fields/m31";
import { QM31 } from "../../fields/qm31";
import { CM31 } from "../../fields/cm31";
import { PackedM31, type PackedBaseField, N_LANES } from "./m31";
import { PackedQM31, type PackedSecureField } from "./qm31";
import { PackedCM31 } from "./cm31";
import { bitReverseM31 } from "./bit_reverse";
import { bitReverse as cpuBitReverse } from "../cpu";
// import { bitReverseM31 } from "./bit_reverse"; // TODO: Implement bit_reverse module

/**
 * An efficient structure for storing and operating on arbitrary number of BaseField values.
 * This corresponds to the Rust BaseColumn struct.
 */
export class BaseColumn implements Column<BaseField> {
  public data: PackedBaseField[];
  public length: number;

  constructor(data: PackedBaseField[], length: number) {
    this.data = data;
    this.length = length;
  }

  /**
   * Creates a BaseColumn from CPU data.
   */
  static fromCpu(values: BaseField[]): BaseColumn {
    const chunks: PackedBaseField[] = [];
    let length = values.length;
    
    // Process full chunks
    for (let i = 0; i < values.length; i += N_LANES) {
      const chunk = values.slice(i, i + N_LANES);
      if (chunk.length === N_LANES) {
        chunks.push(PackedM31.fromArray(chunk));
      } else {
        // Pad the last chunk with zeros
        const padded = [...chunk];
        while (padded.length < N_LANES) {
          padded.push(M31.zero());
        }
        chunks.push(PackedM31.fromArray(padded));
      }
    }
    
    return new BaseColumn(chunks, length);
  }

  /**
   * Creates a BaseColumn from SIMD data.
   */
  static fromSimd(values: PackedBaseField[]): BaseColumn {
    return new BaseColumn(values, values.length * N_LANES);
  }

  /**
   * Extracts a slice containing the entire vector of BaseFields.
   */
  asSlice(): BaseField[] {
    return this.toCpu();
  }

  /**
   * Extracts a mutable slice containing the entire vector of BaseFields.
   */
  asMutSlice(): BaseField[] {
    return this.toCpu();
  }

  /**
   * Converts to CPU vector.
   */
  intoCpuVec(): BaseField[] {
    return this.toCpu();
  }

  /**
   * Creates a column filled with zeros.
   */
  zeros(length: number): Column<BaseField> {
    const numChunks = Math.ceil(length / N_LANES);
    const data = Array.from({ length: numChunks }, () => PackedM31.zero());
    return new BaseColumn(data, length);
  }

  /**
   * Creates an uninitialized column.
   */
  uninitialized(length: number): Column<BaseField> {
    // In TypeScript, we can't have truly uninitialized memory, so we fill with zeros
    return this.zeros(length);
  }

  /**
   * Converts to CPU array.
   */
  toCpu(): BaseField[] {
    const result: BaseField[] = [];
    for (let i = 0; i < this.data.length; i++) {
      const chunk = this.data[i]!.toArray();
      for (let j = 0; j < N_LANES && result.length < this.length; j++) {
        result.push(chunk[j]!);
      }
    }
    return result.slice(0, this.length);
  }

  /**
   * Returns the length of the column.
   */
  len(): number {
    return this.length;
  }

  /**
   * Returns true if the column is empty.
   */
  isEmpty(): boolean {
    return this.length === 0;
  }

  /**
   * Gets element at index.
   */
  at(index: number): BaseField {
    if (index < 0 || index >= this.length) {
      throw new Error(`Index ${index} out of bounds for length ${this.length}`);
    }
    const chunkIndex = Math.floor(index / N_LANES);
    const elementIndex = index % N_LANES;
    return this.data[chunkIndex]!.at(elementIndex);
  }

  /**
   * Sets element at index.
   */
  set(index: number, value: BaseField): void {
    if (index < 0 || index >= this.length) {
      throw new Error(`Index ${index} out of bounds for length ${this.length}`);
    }
    const chunkIndex = Math.floor(index / N_LANES);
    const elementIndex = index % N_LANES;
    this.data[chunkIndex]!.set(elementIndex, value);
  }

  /**
   * Bit reverses the column in place.
   */
  bitReverse(): void {
    bitReverseM31(this.data, this.length);
  }

  /**
   * Returns chunks for parallel processing.
   */
  chunksMut(chunkSize: number): BaseColumnMutSlice[] {
    const result: BaseColumnMutSlice[] = [];
    for (let i = 0; i < this.data.length; i += chunkSize) {
      const chunk = this.data.slice(i, i + chunkSize);
      result.push(new BaseColumnMutSlice(chunk));
    }
    return result;
  }

  /**
   * Converts to SecureColumn.
   */
  intoSecureColumn(): SecureColumn {
    const secureData = this.data.map(packed => PackedQM31.fromPackedM31(packed));
    return new SecureColumn(secureData, this.length);
  }
}

/**
 * Mutable slice of BaseColumn for parallel processing.
 */
export class BaseColumnMutSlice {
  constructor(public data: PackedBaseField[]) {}

  at(index: number): BaseField {
    const chunkIndex = Math.floor(index / N_LANES);
    const elementIndex = index % N_LANES;
    return this.data[chunkIndex]!.at(elementIndex);
  }

  set(index: number, value: BaseField): void {
    const chunkIndex = Math.floor(index / N_LANES);
    const elementIndex = index % N_LANES;
    this.data[chunkIndex]!.set(elementIndex, value);
  }
}

/**
 * An efficient structure for storing and operating on arbitrary number of SecureField values.
 * This corresponds to the Rust SecureColumn struct.
 */
export class SecureColumn implements Column<SecureField> {
  public data: PackedSecureField[];
  public length: number;

  constructor(data: PackedSecureField[], length: number) {
    this.data = data;
    this.length = length;
  }

  /**
   * Creates a SecureColumn from CPU data.
   */
  static fromCpu(values: SecureField[]): SecureColumn {
    const chunks: PackedSecureField[] = [];
    let length = values.length;
    
    // Process full chunks
    for (let i = 0; i < values.length; i += N_LANES) {
      const chunk = values.slice(i, i + N_LANES);
      if (chunk.length === N_LANES) {
        chunks.push(PackedQM31.fromArray(chunk));
      } else {
        // Pad the last chunk with zeros
        const padded = [...chunk];
        while (padded.length < N_LANES) {
          padded.push(QM31.zero());
        }
        chunks.push(PackedQM31.fromArray(padded));
      }
    }
    
    return new SecureColumn(chunks, length);
  }

  /**
   * Creates a SecureColumn from SIMD data.
   */
  static fromSimd(values: PackedSecureField[]): SecureColumn {
    return new SecureColumn(values, values.length * N_LANES);
  }

  /**
   * Creates a column filled with zeros.
   */
  zeros(length: number): Column<SecureField> {
    const numChunks = Math.ceil(length / N_LANES);
    const data = Array.from({ length: numChunks }, () => PackedQM31.zero());
    return new SecureColumn(data, length);
  }

  /**
   * Creates an uninitialized column.
   */
  uninitialized(length: number): Column<SecureField> {
    // In TypeScript, we can't have truly uninitialized memory, so we fill with zeros
    return this.zeros(length);
  }

  /**
   * Converts to CPU array.
   */
  toCpu(): SecureField[] {
    const result: SecureField[] = [];
    for (let i = 0; i < this.data.length; i++) {
      const chunk = this.data[i]!.toArray();
      for (let j = 0; j < N_LANES && result.length < this.length; j++) {
        result.push(chunk[j]!);
      }
    }
    return result.slice(0, this.length);
  }

  /**
   * Returns the length of the column.
   */
  len(): number {
    return this.length;
  }

  /**
   * Returns true if the column is empty.
   */
  isEmpty(): boolean {
    return this.length === 0;
  }

  /**
   * Gets element at index.
   */
  at(index: number): SecureField {
    if (index < 0 || index >= this.length) {
      throw new Error(`Index ${index} out of bounds for length ${this.length}`);
    }
    const chunkIndex = Math.floor(index / N_LANES);
    const elementIndex = index % N_LANES;
    return this.data[chunkIndex]!.at(elementIndex);
  }

  /**
   * Sets element at index.
   */
  set(index: number, value: SecureField): void {
    if (index < 0 || index >= this.length) {
      throw new Error(`Index ${index} out of bounds for length ${this.length}`);
    }
    const chunkIndex = Math.floor(index / N_LANES);
    const elementIndex = index % N_LANES;
    this.data[chunkIndex]!.set(elementIndex, value);
  }

  /**
   * Bit reverses the column in place.
   */
  bitReverse(): void {
    // For SecureField, fall back to CPU implementation for now
    const cpuData = this.toCpu();
    cpuBitReverse(cpuData);
    
    // Convert back to SIMD format
    for (let i = 0; i < cpuData.length; i++) {
      const chunkIndex = Math.floor(i / N_LANES);
      const elementIndex = i % N_LANES;
      if (chunkIndex < this.data.length) {
        this.data[chunkIndex]!.set(elementIndex, cpuData[i]!);
      }
    }
  }
}

/**
 * An efficient structure for storing and operating on arbitrary number of CM31 values.
 * This corresponds to the Rust CM31Column struct.
 */
export class CM31Column implements Column<CM31> {
  public data: PackedCM31[];
  public length: number;

  constructor(data: PackedCM31[], length: number) {
    this.data = data;
    this.length = length;
  }

  /**
   * Creates a CM31Column from CPU data.
   */
  static fromCpu(values: CM31[]): CM31Column {
    const chunks: PackedCM31[] = [];
    let length = values.length;
    
    // Process full chunks
    for (let i = 0; i < values.length; i += N_LANES) {
      const chunk = values.slice(i, i + N_LANES);
      if (chunk.length === N_LANES) {
        chunks.push(PackedCM31.fromArray(chunk));
      } else {
        // Pad the last chunk with zeros
        const padded = [...chunk];
        while (padded.length < N_LANES) {
          padded.push(CM31.zero());
        }
        chunks.push(PackedCM31.fromArray(padded));
      }
    }
    
    return new CM31Column(chunks, length);
  }

  /**
   * Creates a CM31Column from SIMD data.
   */
  static fromSimd(values: PackedCM31[]): CM31Column {
    return new CM31Column(values, values.length * N_LANES);
  }

  /**
   * Creates a column filled with zeros.
   */
  zeros(length: number): Column<CM31> {
    const numChunks = Math.ceil(length / N_LANES);
    const data = Array.from({ length: numChunks }, () => PackedCM31.zero());
    return new CM31Column(data, length);
  }

  /**
   * Creates an uninitialized column.
   */
  uninitialized(length: number): Column<CM31> {
    // In TypeScript, we can't have truly uninitialized memory, so we fill with zeros
    return this.zeros(length);
  }

  /**
   * Converts to CPU array.
   */
  toCpu(): CM31[] {
    const result: CM31[] = [];
    for (let i = 0; i < this.data.length; i++) {
      const chunk = this.data[i]!.toArray();
      for (let j = 0; j < N_LANES && result.length < this.length; j++) {
        result.push(chunk[j]!);
      }
    }
    return result.slice(0, this.length);
  }

  /**
   * Returns the length of the column.
   */
  len(): number {
    return this.length;
  }

  /**
   * Returns true if the column is empty.
   */
  isEmpty(): boolean {
    return this.length === 0;
  }

  /**
   * Gets element at index.
   */
  at(index: number): CM31 {
    if (index < 0 || index >= this.length) {
      throw new Error(`Index ${index} out of bounds for length ${this.length}`);
    }
    const chunkIndex = Math.floor(index / N_LANES);
    const elementIndex = index % N_LANES;
    return this.data[chunkIndex]!.at(elementIndex);
  }

  /**
   * Sets element at index.
   */
  set(index: number, value: CM31): void {
    if (index < 0 || index >= this.length) {
      throw new Error(`Index ${index} out of bounds for length ${this.length}`);
    }
    const chunkIndex = Math.floor(index / N_LANES);
    const elementIndex = index % N_LANES;
    this.data[chunkIndex]!.set(elementIndex, value);
  }

  /**
   * Bit reverses the column in place.
   */
  bitReverse(): void {
    // For CM31, fall back to CPU implementation for now
    const cpuData = this.toCpu();
    cpuBitReverse(cpuData);
    
    // Convert back to SIMD format
    for (let i = 0; i < cpuData.length; i++) {
      const chunkIndex = Math.floor(i / N_LANES);
      const elementIndex = i % N_LANES;
      if (chunkIndex < this.data.length) {
        this.data[chunkIndex]!.set(elementIndex, cpuData[i]!);
      }
    }
  }
} 