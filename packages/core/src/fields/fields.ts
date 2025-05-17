import { M31 } from './m31';

/**
 * Interface for field operations requiring exponentiation
 */
export interface FieldExpOps<T> {
  square(): T;
  pow(exp: number): T;
  inverse(): T;
  mul(other: T): T;
  clone(): T;
}

/**
 * Interface for field operations
 */
export interface Field<T> extends FieldExpOps<T> {
  add(other: T): T;
  sub(other: T): T;
  neg(): T;
  equals(other: T): boolean;
  isZero(): boolean;
  complexConjugate(): T;
  double(): T;
}

/**
 * Interface for field extension
 */
export interface ExtensionOf<F, T extends Field<T>> extends Field<T> {
  readonly EXTENSION_DEGREE: number;
}

/**
 * Interface for types that can be converted to a byte array
 */
export interface IntoSlice<T> {
  intoSlice(elements: T[]): Uint8Array;
}

/**
 * Interface for complex conjugate operation
 */
export interface ComplexConjugate<T> {
  complexConjugate(): T;
}

/**
 * Some field implementations to make a 'one' element
 */
function createOne<T extends FieldExpOps<T>>(example: T): T {
  if ('one' in example.constructor) {
    // @ts-ignore - we're checking at runtime
    return example.constructor.one();
  }
  
  // Fallback: try to create one by dividing an element by itself (x/x = 1)
  // This assumes the element is non-zero and inverse operation is correct
  return example.mul(example.inverse());
}

/**
 * Inverts a batch of elements in a non-optimized way
 * Assumes dst is initialized and of the same length as column.
 */
export function batchInverseClassic<T extends FieldExpOps<T>>(column: T[], dst: T[]): void {
  const n = column.length;
  if (dst.length < n) {
    throw new Error('Destination array is too small');
  }

  if (n === 0) {
    return;
  }

  // First pass
  dst[0] = column[0].clone();
  for (let i = 1; i < n; i++) {
    dst[i] = dst[i - 1].mul(column[i]);
  }

  // Inverse cumulative product
  let currInverse = dst[n - 1].inverse();

  // Second pass
  for (let i = n - 1; i > 0; i--) {
    dst[i] = dst[i - 1].mul(currInverse);
    currInverse = currInverse.mul(column[i]);
  }
  dst[0] = currInverse;
}

/**
 * Inverts a batch of elements using Montgomery's trick.
 */
export function batchInverseInPlace<T extends FieldExpOps<T>>(column: T[], dst: T[]): void {
  const WIDTH = 4;
  const n = column.length;
  
  if (dst.length < n) {
    throw new Error('Destination array is too small');
  }

  if (n <= WIDTH || n % WIDTH !== 0) {
    batchInverseClassic(column, dst);
    return;
  }

  // We need at least one element to create ONE
  if (column.length === 0) {
    return;
  }

  // Get an example element to create our ONE value
  const example = column[0];
  const one = createOne(example);

  // First pass. Compute 'WIDTH' cumulative products in an interleaving fashion
  const cumProd: T[] = Array(WIDTH);
  for (let i = 0; i < WIDTH; i++) {
    cumProd[i] = one.clone();
  }
  
  // Copy cumProd to the first WIDTH elements of dst
  for (let i = 0; i < WIDTH; i++) {
    dst[i] = cumProd[i].clone();
  }
  
  // Compute cumulative products
  for (let i = 0; i < n; i++) {
    cumProd[i % WIDTH] = cumProd[i % WIDTH].mul(column[i]);
    dst[i] = cumProd[i % WIDTH].clone();
  }

  // Inverse cumulative products
  // Use classic batch inversion
  const tailInverses: T[] = Array(WIDTH);
  for (let i = 0; i < WIDTH; i++) {
    tailInverses[i] = one.clone();
  }
  
  // Create a temporary array for batch inverse classic
  const tempDst: T[] = Array(WIDTH);
  for (let i = 0; i < WIDTH; i++) {
    tempDst[i] = dst[n - WIDTH + i].clone();
  }
  
  batchInverseClassic(tempDst, tailInverses);

  // Second pass
  for (let i = n - 1; i >= WIDTH; i--) {
    dst[i] = dst[i - WIDTH].mul(tailInverses[i % WIDTH]);
    tailInverses[i % WIDTH] = tailInverses[i % WIDTH].mul(column[i]);
  }
  
  // Copy tailInverses to the first WIDTH elements of dst
  for (let i = 0; i < WIDTH; i++) {
    dst[i] = tailInverses[i].clone();
  }
}

/**
 * Inverts a batch of elements and returns them as a new array
 */
export function batchInverse<T extends FieldExpOps<T>>(column: T[]): T[] {
  if (column.length === 0) {
    return [];
  }
  
  // Create a destination array of the same size as column
  const dst: T[] = Array(column.length);
  
  // Initialize dst array with clones of the first element
  for (let i = 0; i < dst.length; i++) {
    dst[i] = column[0].clone();
  }
  
  batchInverseInPlace(column, dst);
  return dst;
}

/**
 * Inverts a batch of elements in chunks
 */
export function batchInverseChunked<T extends FieldExpOps<T>>(
  column: T[], 
  dst: T[], 
  chunkSize: number
): void {
  if (column.length > dst.length) {
    throw new Error('Destination array is too small');
  }

  // Process each chunk
  for (let i = 0; i < column.length; i += chunkSize) {
    const end = Math.min(i + chunkSize, column.length);
    const columnChunk = column.slice(i, end);
    const dstChunk = dst.slice(i, end);
    
    batchInverseInPlace(columnChunk, dstChunk);
    
    // Copy results back to dst
    for (let j = 0; j < columnChunk.length; j++) {
      dst[i + j] = dstChunk[j];
    }
  }
}

/**
 * Helper utilities for field implementations
 */
export const FieldUtils = {
  /**
   * Create an empty array of the given size
   */
  uninitVec<T>(size: number): T[] {
    return new Array(size);
  },
  
  /**
   * Convert a TypedArray to a regular array
   */
  typedArrayToArray<T>(typedArray: Uint8Array | Uint32Array, converter: (val: number) => T): T[] {
    const result: T[] = [];
    for (let i = 0; i < typedArray.length; i++) {
      result.push(converter(typedArray[i]));
    }
    return result;
  }
};

// Export the test utilities for testing the batch inversion functions
export const TestUtils = {
  /**
   * Test batch inverse functions
   */
  testBatchInverse(elements: M31[]): boolean {
    const expected = elements.map(e => e.inverse());
    const actual = batchInverse(elements);
    
    // Compare the results
    if (expected.length !== actual.length) {
      return false;
    }
    
    for (let i = 0; i < expected.length; i++) {
      if (!expected[i].equals(actual[i])) {
        return false;
      }
    }
    
    return true;
  },
  
  /**
   * Test batch inverse chunked
   */
  testBatchInverseChunked(elements: M31[], chunkSize: number): boolean {
    const expected = batchInverse(elements);
    const result: M31[] = Array(elements.length);
    
    // Initialize result array with dummy values
    for (let i = 0; i < result.length; i++) {
      result[i] = M31.zero();
    }
    
    batchInverseChunked(elements, result, chunkSize);
    
    // Compare the results
    if (expected.length !== result.length) {
      return false;
    }
    
    for (let i = 0; i < expected.length; i++) {
      if (!expected[i].equals(result[i])) {
        return false;
      }
    }
    
    return true;
  }
}; 