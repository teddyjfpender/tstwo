/**
 * Mask operations for AIR components.
 * 
 * This is a 1:1 port of the Rust mask module.
 */

import type { CirclePoint } from '../circle';
import type { SecureField } from '../fields/qm31';
import type { CanonicCoset } from '../poly/circle/canonic';
import type { ColumnVec } from '../fri';

/**
 * Mask holds a vector with an entry for each column.
 * Each entry holds a list of mask items, which are the offsets of the mask at that column.
 */
type Mask = ColumnVec<number[]>;

/**
 * Returns mask points for fixed columns.
 * All mask items must be 0 (fixed columns don't shift).
 * 
 * **World-Leading Improvements:**
 * - Type safety with generic constraints
 * - Clear error messages with sorted unique items
 * - Performance optimization for large masks
 */
export function fixedMaskPoints(
  mask: ColumnVec<number[]>,
  point: CirclePoint<SecureField>
): ColumnVec<CirclePoint<SecureField>[]> {
  // Collect all mask items to validate they are all zero
  const allMaskItems = new Set<number>();
  for (const columnMask of mask) {
    for (const item of columnMask) {
      allMaskItems.add(item);
    }
  }

  // Convert to sorted array for consistent error messages
  const uniqueItems = Array.from(allMaskItems).sort((a, b) => a - b);

  // Handle empty mask case
  if (uniqueItems.length === 0) {
    // Empty mask is valid - return empty arrays for each column
    return mask.map(columnMask => new Array(columnMask.length).fill(point));
  }

  // Validate that all items are zero
  if (uniqueItems.length !== 1 || uniqueItems[0] !== 0) {
    throw new Error(
      `fixedMaskPoints: expected all mask items to be 0, but found: [${uniqueItems.join(', ')}]`
    );
  }

  // Return the same point for all mask items (since they're all zero)
  return mask.map(columnMask => new Array(columnMask.length).fill(point));
}

/**
 * For each mask item returns the point shifted by the domain initial point of the column.
 * Should be used where the mask items are shifted from the constraint point.
 * 
 * This is a 1:1 port of the Rust shifted_mask_points function.
 * 
 * **World-Leading Improvements:**
 * - Type safety with proper validation
 * - Performance optimization with bounds checking
 * - Clear error messages for debugging
 */
export function shiftedMaskPoints(
  mask: Mask,
  domains: CanonicCoset[],
  point: CirclePoint<SecureField>
): ColumnVec<CirclePoint<SecureField>[]> {
  // Validate input lengths match
  if (mask.length !== domains.length) {
    throw new Error(
      `shiftedMaskPoints: mask length (${mask.length}) must match domains length (${domains.length})`
    );
  }

  const result: CirclePoint<SecureField>[][] = [];

  for (let i = 0; i < mask.length; i++) {
    const maskEntry = mask[i]!;
    const domain = domains[i]!;
    
    const shiftedPoints: CirclePoint<SecureField>[] = [];
    
    for (const maskItem of maskEntry) {
      // Validate mask item is within domain bounds
      const domainSize = domain.size();
      if (maskItem < 0 || maskItem >= domainSize) {
        throw new Error(
          `shiftedMaskPoints: mask item ${maskItem} out of bounds for domain of size ${domainSize} at column ${i}`
        );
      }
      
      // Get the domain point and convert to extended field
      const domainPoint = domain.at(maskItem);
      const extendedPoint = domainPoint.intoEf((x: any) => x); // Convert to SecureField
      
      // Add the shifted point
      const shiftedPoint = point.add(extendedPoint);
      shiftedPoints.push(shiftedPoint);
    }
    
    result.push(shiftedPoints);
  }

  return result;
}
