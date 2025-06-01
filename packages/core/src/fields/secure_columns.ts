/*
This is the Rust code from fields/secure_columns.rs that needs to be ported to Typescript in this secure_columns.ts file:
```rs
use std::array;
use std::iter::zip;

use super::m31::BaseField;
use super::qm31::SecureField;
use super::ExtensionOf;
use crate::core::backend::{Col, Column, ColumnOps, CpuBackend};

pub const SECURE_EXTENSION_DEGREE: usize =
    <SecureField as ExtensionOf<BaseField>>::EXTENSION_DEGREE;

/// A column major array of `SECURE_EXTENSION_DEGREE` base field columns, that represents a column
/// of secure field element coordinates.
#[derive(Clone, Debug)]
pub struct SecureColumnByCoords<B: ColumnOps<BaseField>> {
    pub columns: [Col<B, BaseField>; SECURE_EXTENSION_DEGREE],
}
impl SecureColumnByCoords<CpuBackend> {
    // TODO(first): Remove.
    pub fn to_vec(&self) -> Vec<SecureField> {
        (0..self.len()).map(|i| self.at(i)).collect()
    }
}
impl<B: ColumnOps<BaseField>> SecureColumnByCoords<B> {
    pub fn at(&self, index: usize) -> SecureField {
        SecureField::from_m31_array(std::array::from_fn(|i| self.columns[i].at(index)))
    }

    pub fn zeros(len: usize) -> Self {
        Self {
            columns: std::array::from_fn(|_| Col::<B, BaseField>::zeros(len)),
        }
    }

    /// # Safety
    pub unsafe fn uninitialized(len: usize) -> Self {
        Self {
            columns: std::array::from_fn(|_| Col::<B, BaseField>::uninitialized(len)),
        }
    }

    pub fn len(&self) -> usize {
        self.columns[0].len()
    }

    pub fn is_empty(&self) -> bool {
        self.columns[0].is_empty()
    }

    pub fn to_cpu(&self) -> SecureColumnByCoords<CpuBackend> {
        SecureColumnByCoords {
            columns: self.columns.clone().map(|c| c.to_cpu()),
        }
    }

    pub fn set(&mut self, index: usize, value: SecureField) {
        let values = value.to_m31_array();
        #[allow(clippy::needless_range_loop)]
        for i in 0..SECURE_EXTENSION_DEGREE {
            self.columns[i].set(index, values[i]);
        }
    }
}

pub struct SecureColumnByCoordsIter<'a> {
    column: &'a SecureColumnByCoords<CpuBackend>,
    index: usize,
}
impl Iterator for SecureColumnByCoordsIter<'_> {
    type Item = SecureField;

    fn next(&mut self) -> Option<Self::Item> {
        if self.index < self.column.len() {
            let value = self.column.at(self.index);
            self.index += 1;
            Some(value)
        } else {
            None
        }
    }
}
impl<'a> IntoIterator for &'a SecureColumnByCoords<CpuBackend> {
    type Item = SecureField;
    type IntoIter = SecureColumnByCoordsIter<'a>;

    fn into_iter(self) -> Self::IntoIter {
        SecureColumnByCoordsIter {
            column: self,
            index: 0,
        }
    }
}
impl FromIterator<SecureField> for SecureColumnByCoords<CpuBackend> {
    fn from_iter<I: IntoIterator<Item = SecureField>>(iter: I) -> Self {
        let values = iter.into_iter();
        let (lower_bound, _) = values.size_hint();
        let mut columns = array::from_fn(|_| Vec::with_capacity(lower_bound));

        for value in values {
            let coords = value.to_m31_array();
            zip(&mut columns, coords).for_each(|(col, coord)| col.push(coord));
        }

        SecureColumnByCoords { columns }
    }
}
impl From<SecureColumnByCoords<CpuBackend>> for Vec<SecureField> {
    fn from(column: SecureColumnByCoords<CpuBackend>) -> Self {
        column.into_iter().collect()
    }
}
```
*/

import { M31 } from "./m31";
import { QM31, SECURE_EXTENSION_DEGREE } from "./qm31";
import type { ColumnOps } from "../backend";
import type { CpuBackend } from "../backend/cpu";

/** Column-major representation of secure field coordinates. */
export class SecureColumnByCoords<B extends ColumnOps<M31>> {
  columns: M31[][];

  constructor(columns: M31[][]) {
    if (columns.length !== SECURE_EXTENSION_DEGREE) {
      throw new Error(`expected ${SECURE_EXTENSION_DEGREE} coordinate columns`);
    }
    const len = columns[0].length;
    if (!columns.every((c) => c.length === len)) {
      throw new Error("coordinate column length mismatch");
    }
    this.columns = columns.map((c) => c.slice());
  }

  static zeros<B extends ColumnOps<M31>>(len: number): SecureColumnByCoords<B> {
    const cols = Array.from({ length: SECURE_EXTENSION_DEGREE }, () =>
      Array.from({ length: len }, () => M31.zero()),
    );
    return new SecureColumnByCoords<B>(cols);
  }

  /** Unsafe constructor used when porting from Rust. In JS just returns zeros. */
  static uninitialized<B extends ColumnOps<M31>>(len: number): SecureColumnByCoords<B> {
    return SecureColumnByCoords.zeros<B>(len);
  }

  len(): number {
    return this.columns[0].length;
  }

  is_empty(): boolean {
    return this.len() === 0;
  }

  /**
   * Retrieves the QM31 element at the specified index.
   * @param index The index of the element to retrieve.
   * @returns The QM31 element at the specified index.
   * @throws Error if the index is out of bounds.
   */
  at(index: number): QM31 {
    if (index < 0 || index >= this.len()) {
      throw new Error("Index out of bounds");
    }
    const coords = this.columns.map((c) => c[index]) as [M31, M31, M31, M31];
    return QM31.fromM31Array(coords);
  }

  /**
   * Sets the QM31 element at the specified index.
   * @param index The index of the element to set.
   * @param value The QM31 value to set.
   * @throws Error if the index is out of bounds.
   */
  set(index: number, value: QM31): void {
    if (index < 0 || index >= this.len()) {
      throw new Error("Index out of bounds");
    }
    const vals = value.toM31Array();
    for (let i = 0; i < SECURE_EXTENSION_DEGREE; i++) {
      this.columns[i][index] = vals[i];
    }
  }

  to_cpu(): SecureColumnByCoords<CpuBackend> {
    return new SecureColumnByCoords<CpuBackend>(this.columns);
  }

  /** Iterate over secure field values. */
  *[Symbol.iterator](): IterableIterator<QM31> {
    for (let i = 0; i < this.len(); i++) {
      yield this.at(i);
    }
  }

  static from(values: Iterable<QM31>): SecureColumnByCoords<CpuBackend> {
    const arr = Array.from(values);
    const cols = Array.from({ length: SECURE_EXTENSION_DEGREE }, () => [] as M31[]);
    for (const v of arr) {
      const coords = v.toM31Array();
      for (let i = 0; i < SECURE_EXTENSION_DEGREE; i++) {
        const coord = coords[i];
        if (coord !== undefined) {
          cols[i]!.push(coord);
        }
      }
    }
    return new SecureColumnByCoords<CpuBackend>(cols);
  }

  to_vec(): QM31[] {
    return Array.from(this);
  }
}
