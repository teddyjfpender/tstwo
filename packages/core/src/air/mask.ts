/*
This is the Rust code from air/mask.rs that needs to be ported to Typescript in this air/mask.ts file:
```rs
use std::collections::HashSet;
use std::vec;

use itertools::Itertools;

use crate::core::circle::CirclePoint;
use crate::core::fields::qm31::SecureField;
use crate::core::poly::circle::CanonicCoset;
use crate::core::ColumnVec;

/// Mask holds a vector with an entry for each column.
/// Each entry holds a list of mask items, which are the offsets of the mask at that column.
type Mask = ColumnVec<Vec<usize>>;

/// Returns the same point for each mask item.
/// Should be used where all the mask items has no shift from the constraint point.
pub fn fixed_mask_points(
    mask: &Mask,
    point: CirclePoint<SecureField>,
) -> ColumnVec<Vec<CirclePoint<SecureField>>> {
    assert_eq!(
        mask.iter()
            .flat_map(|mask_entry| mask_entry.iter().collect::<HashSet<_>>())
            .collect::<HashSet<&usize>>()
            .into_iter()
            .collect_vec(),
        vec![&0]
    );
    mask.iter()
        .map(|mask_entry| mask_entry.iter().map(|_| point).collect())
        .collect()
}

/// For each mask item returns the point shifted by the domain initial point of the column.
/// Should be used where the mask items are shifted from the constraint point.
pub fn shifted_mask_points(
    mask: &Mask,
    domains: &[CanonicCoset],
    point: CirclePoint<SecureField>,
) -> ColumnVec<Vec<CirclePoint<SecureField>>> {
    mask.iter()
        .zip(domains.iter())
        .map(|(mask_entry, domain)| {
            mask_entry
                .iter()
                .map(|mask_item| point + domain.at(*mask_item).into_ef())
                .collect()
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use crate::core::air::mask::{fixed_mask_points, shifted_mask_points};
    use crate::core::circle::CirclePoint;
    use crate::core::poly::circle::CanonicCoset;

    #[test]
    fn test_mask_fixed_points() {
        let mask = vec![vec![0], vec![0]];
        let constraint_point = CirclePoint::get_point(1234);

        let points = fixed_mask_points(&mask, constraint_point);

        assert_eq!(points.len(), 2);
        assert_eq!(points[0].len(), 1);
        assert_eq!(points[1].len(), 1);
        assert_eq!(points[0][0], constraint_point);
        assert_eq!(points[1][0], constraint_point);
    }

    #[test]
    fn test_mask_shifted_points() {
        let mask = vec![vec![0, 1], vec![0, 1, 2]];
        let constraint_point = CirclePoint::get_point(1234);
        let domains = (0..mask.len() as u32)
            .map(|i| CanonicCoset::new(7 + i))
            .collect::<Vec<_>>();

        let points = shifted_mask_points(&mask, &domains, constraint_point);

        assert_eq!(points.len(), 2);
        assert_eq!(points[0].len(), 2);
        assert_eq!(points[1].len(), 3);
        assert_eq!(points[0][0], constraint_point + domains[0].at(0).into_ef());
        assert_eq!(points[0][1], constraint_point + domains[0].at(1).into_ef());
        assert_eq!(points[1][0], constraint_point + domains[1].at(0).into_ef());
        assert_eq!(points[1][1], constraint_point + domains[1].at(1).into_ef());
        assert_eq!(points[1][2], constraint_point + domains[1].at(2).into_ef());
    }
}
```
*/

// TODO(Jules): Port the Rust type alias `Mask` and functions `fixed_mask_points` and
// `shifted_mask_points` to TypeScript.
//
// Task: Port the Rust type alias `Mask` and the functions `fixed_mask_points` and
// `shifted_mask_points` to TypeScript.
//
// Details:
// - Mask type: Defined as `ColumnVec<Vec<usize>>` in Rust. This will likely be
//   `ColumnVec<number[]>` in TypeScript. It represents a list of mask item offsets
//   for each column.
//
// - fixed_mask_points(mask: Mask, point: CirclePoint<SecureField>): ColumnVec<Vec<CirclePoint<SecureField>>>
//   - Returns the same `point` for each mask item within each column's mask entry.
//   - Used when mask items represent no shift (i.e., offset 0) relative to the constraint point.
//   - The Rust version includes an assertion that all mask items are 0. This assertion logic
//     should be preserved or adapted.
//
// - shifted_mask_points(mask: Mask, domains: CanonicCoset[], point: CirclePoint<SecureField>): ColumnVec<Vec<CirclePoint<SecureField>>>
//   - For each mask item, returns the `point` shifted by the corresponding domain element.
//   - Specifically, for a mask item `m` in a column `j` (associated with `domains[j]`),
//     the generated point is `point + domains[j].at(m).into_ef()`.
//   - Used when mask items represent shifts relative to the constraint point.
//
// Dependencies:
// - `CirclePoint` from `core/src/circle.ts` (or its actual location, e.g., `core/src/poly/circle/point.ts`).
// - `SecureField` from `core/src/fields/qm31.ts`.
// - `CanonicCoset` from `core/src/poly/circle/canonic.ts`.
// - `ColumnVec` utility type/class (e.g., from `core/src/pcs/utils.ts` or a general utility module,
//   or it might be a simple array type alias `T[][]` or `Array<Array<T>>` if ColumnVec is not complex).
//   Note: `usize` in Rust typically maps to `number` in TypeScript.
//
// Goal: Provide helper functions to generate specific evaluation points required for
// Out-of-Domain Sampling (OODS) based on a mask structure. These functions are crucial
// for evaluating polynomials at shifted points, a common operation in STARK protocols,
// particularly for boundary constraints and FRI.
//
// Tests: Port the existing Rust tests (`test_mask_fixed_points` and
// `test_mask_shifted_points`) to TypeScript to ensure the ported functions behave
// identically.