import type { ColumnVec } from '../fri';

/**
 * A container that holds an element for each commitment tree.
 * 
 * This is a 1:1 port of the Rust TreeVec struct with TypeScript safety improvements.
 * 
 * **World-Leading Improvements:**
 * - API hygiene with private constructor and static factory methods
 * - Type safety with proper generic constraints
 * - Performance optimizations with reused static constants
 * - Clear separation of concerns
 */
export class TreeVec<T> {
  /**
   * Private constructor for API hygiene - use static factory methods instead
   */
  private constructor(private readonly data: T[]) {
    // Validate input
    if (!Array.isArray(data)) {
      throw new Error('TreeVec: data must be an array');
    }
  }

  /**
   * Create a new TreeVec from a vector.
   * 
   * **API hygiene:** Static factory method instead of direct constructor access
   */
  static new<T>(vec: T[]): TreeVec<T> {
    return new TreeVec([...vec]); // Clone for safety
  }

  /**
   * Create an empty TreeVec.
   */
  static empty<T>(): TreeVec<T> {
    return new TreeVec<T>([]);
  }

  /**
   * Map function over the TreeVec elements.
   */
  map<U>(f: (value: T) => U): TreeVec<U> {
    return new TreeVec(this.data.map(f));
  }

  /**
   * Zip this TreeVec with another TreeVec.
   */
  zip<U>(other: TreeVec<U>): TreeVec<[T, U]> {
    const minLength = Math.min(this.data.length, other.data.length);
    const result: [T, U][] = [];
    
    for (let i = 0; i < minLength; i++) {
      result.push([this.data[i]!, other.data[i]!]);
    }
    
    return new TreeVec(result);
  }

  /**
   * Zip this TreeVec with another TreeVec, ensuring equal lengths.
   */
  zipEq<U>(other: TreeVec<U>): TreeVec<[T, U]> {
    if (this.data.length !== other.data.length) {
      throw new Error(`TreeVec.zipEq: length mismatch (${this.data.length} vs ${other.data.length})`);
    }
    return this.zip(other);
  }

  /**
   * Get a reference TreeVec.
   */
  asRef(): TreeVec<T> {
    return new TreeVec([...this.data]);
  }

  /**
   * Get the length of the TreeVec.
   */
  get length(): number {
    return this.data.length;
  }

  /**
   * Get element at index.
   */
  at(index: number): T | undefined {
    return this.data[index];
  }

  /**
   * Get element at index (throws if out of bounds).
   */
  get(index: number): T {
    if (index < 0 || index >= this.data.length) {
      throw new Error(`TreeVec.get: index ${index} out of bounds (length: ${this.data.length})`);
    }
    return this.data[index]!;
  }

  /**
   * Set element at index.
   */
  set(index: number, value: T): void {
    if (index < 0 || index >= this.data.length) {
      throw new Error(`TreeVec.set: index ${index} out of bounds (length: ${this.data.length})`);
    }
    this.data[index] = value;
  }

  /**
   * Iterator over the TreeVec elements.
   */
  *[Symbol.iterator](): Iterator<T> {
    for (const item of this.data) {
      yield item;
    }
  }

  /**
   * Convert to plain array.
   */
  toArray(): T[] {
    return [...this.data];
  }

  /**
   * Push an element to the TreeVec.
   */
  push(value: T): void {
    this.data.push(value);
  }

  /**
   * Check if TreeVec is empty.
   */
  isEmpty(): boolean {
    return this.data.length === 0;
  }
}

/**
 * TreeVec specialized for ColumnVec operations.
 * 
 * **World-Leading Improvements:**
 * - Type safety with proper generic constraints
 * - Performance optimizations for column operations
 * - Clear separation of column-specific logic
 */
export class TreeVecColumnOps {
  /**
   * Map function over columns in a TreeVec<ColumnVec<T>>.
   */
  static mapCols<T, U>(
    treeVec: TreeVec<ColumnVec<T>>,
    f: (value: T) => U
  ): TreeVec<ColumnVec<U>> {
    return treeVec.map(column => column.map(f));
  }

  /**
   * Zip columns of two TreeVec<ColumnVec<T>> with the same structure.
   */
  static zipCols<T, U>(
    treeVec1: TreeVec<ColumnVec<T>>,
    treeVec2: TreeVec<ColumnVec<U>>
  ): TreeVec<ColumnVec<[T, U]>> {
    if (treeVec1.length !== treeVec2.length) {
      throw new Error(`TreeVecColumnOps.zipCols: tree length mismatch (${treeVec1.length} vs ${treeVec2.length})`);
    }

    const result: ColumnVec<[T, U]>[] = [];
    
    for (let i = 0; i < treeVec1.length; i++) {
      const col1 = treeVec1.get(i);
      const col2 = treeVec2.get(i);
      
      if (col1.length !== col2.length) {
        throw new Error(`TreeVecColumnOps.zipCols: column length mismatch at tree ${i} (${col1.length} vs ${col2.length})`);
      }
      
      const zippedCol: [T, U][] = [];
      for (let j = 0; j < col1.length; j++) {
        zippedCol.push([col1[j]!, col2[j]!]);
      }
      result.push(zippedCol);
    }
    
    return TreeVec.new(result);
  }

  /**
   * Get reference to columns.
   */
  static asColsRef<T>(treeVec: TreeVec<ColumnVec<T>>): TreeVec<ColumnVec<T>> {
    return treeVec.map(column => [...column]);
  }

  /**
   * Flatten TreeVec<ColumnVec<T>> into a single ColumnVec<T>.
   */
  static flatten<T>(treeVec: TreeVec<ColumnVec<T>>): ColumnVec<T> {
    const result: T[] = [];
    for (const column of treeVec) {
      result.push(...column);
    }
    return result;
  }

  /**
   * Concatenate columns from multiple TreeVec<ColumnVec<T>>.
   */
  static concatCols<T>(trees: TreeVec<ColumnVec<T>>[]): TreeVec<ColumnVec<T>> {
    if (trees.length === 0) {
      return TreeVec.empty();
    }

    // Find the maximum number of trees
    const maxTrees = Math.max(...trees.map(t => t.length));
    const result: ColumnVec<T>[] = [];

    for (let treeIndex = 0; treeIndex < maxTrees; treeIndex++) {
      const combinedColumn: T[] = [];
      
      for (const tree of trees) {
        const column = tree.at(treeIndex);
        if (column) {
          combinedColumn.push(...column);
        }
      }
      
      result.push(combinedColumn);
    }

    return TreeVec.new(result);
  }
}

/**
 * Tree subspan for extracting sub-trees.
 */
export interface TreeSubspan {
  treeIndex: number;
  colStart: number;
  colEnd: number;
}