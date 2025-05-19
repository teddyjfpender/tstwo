export interface Backend {}

export interface BackendForChannel<C> {}

export interface Column<T> {
  /** Length of the column */
  len(): number;
  /** Get value at index */
  at(index: number): T;
  /** Set value at index */
  set(index: number, value: T): void;
  /** Convert the column into a plain CPU array */
  toCPU(): T[];
}

export interface ColumnOps<T> {
  /** Performs an in-place bit reverse on the column */
  bitReverseColumn(column: T[]): void;
}
