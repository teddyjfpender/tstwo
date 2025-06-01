import { BaseColumn } from "../../../packages/core/src/backend/simd/column";
import { N_LANES, LOG_N_LANES } from "../../../packages/core/src/backend/simd/m31";
import { M31 } from "../../../packages/core/src/fields/m31";
import { CanonicCoset } from "../../../packages/core/src/poly/circle/canonic";
import { CircleEvaluation } from "../../../packages/core/src/poly/circle/evaluation";
import { BitReversedOrder } from "../../../packages/core/src/poly";
import { SimdBackend } from "../../../packages/core/src/backend/simd";

// Table configuration interface to match Rust test vectors
export interface TableConfig {
    col1_val0: number;
    col1_val1: number;
    col2_val0: number;
    col2_val1: number;
}

// Default configuration matching the original hardcoded values
export const DEFAULT_TABLE_CONFIG: TableConfig = {
    col1_val0: 1,
    col1_val1: 7,
    col2_val0: 5,
    col2_val1: 11
};

export function fromSpreadsheetToTracePolynomials(config: TableConfig = DEFAULT_TABLE_CONFIG) {
    const numRows = N_LANES;
    const logNumRows = LOG_N_LANES;

    // Create the table with configurable values
    const zerosArray1 = Array.from({ length: numRows }, () => M31.zero());
    const col1 = BaseColumn.fromCpu(zerosArray1);
    col1.set(0, M31.from(config.col1_val0));
    col1.set(1, M31.from(config.col1_val1));

    const zerosArray2 = Array.from({ length: numRows }, () => M31.zero());
    const col2 = BaseColumn.fromCpu(zerosArray2);
    col2.set(0, M31.from(config.col2_val0));
    col2.set(1, M31.from(config.col2_val1));

    // Convert table to trace polynomials
    const domain = CanonicCoset.new(logNumRows).circleDomain();
    const trace: CircleEvaluation<SimdBackend, M31, BitReversedOrder>[] = 
        [col1, col2].map(col => new CircleEvaluation(domain, col.toCpu()));

    return {
        numRows,
        logNumRows,
        col1,
        col2,
        domain,
        trace,
        config // Include the config used for reference
    };
} 