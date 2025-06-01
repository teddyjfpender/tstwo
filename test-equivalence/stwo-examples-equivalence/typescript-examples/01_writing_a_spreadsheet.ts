import { BaseColumn } from "@tstwo/core/src/backend/simd/column";
import { N_LANES } from "@tstwo/core/src/backend/simd/m31";
import { M31 } from "@tstwo/core/src/fields/m31";

export function writeSpreadsheet() {
    const numRows = N_LANES;

    // Create zero-filled arrays and convert to BaseColumn
    const zerosArray1 = Array.from({ length: numRows }, () => M31.zero());
    const col1 = BaseColumn.fromCpu(zerosArray1);
    col1.set(0, M31.from(1));
    col1.set(1, M31.from(7));

    const zerosArray2 = Array.from({ length: numRows }, () => M31.zero());
    const col2 = BaseColumn.fromCpu(zerosArray2);
    col2.set(0, M31.from(5));
    col2.set(1, M31.from(11));

    return {
        col1,
        col2,
        numRows
    };
} 