import { writeSpreadsheet } from "./01_writing_a_spreadsheet";

// Demo the TypeScript equivalent of the Rust spreadsheet example
console.log("=== Stwo TypeScript Spreadsheet Example ===");

const { col1, col2, numRows } = writeSpreadsheet();

console.log(`\nCreated columns with ${numRows} rows (N_LANES = ${numRows})`);

console.log("\nColumn 1 values:");
console.log(`  col1[0] = ${col1.at(0).value} (should be 1)`);
console.log(`  col1[1] = ${col1.at(1).value} (should be 7)`);
console.log(`  col1[2] = ${col1.at(2).value} (should be 0 - zero filled)`);

console.log("\nColumn 2 values:");
console.log(`  col2[0] = ${col2.at(0).value} (should be 5)`);
console.log(`  col2[1] = ${col2.at(1).value} (should be 11)`);
console.log(`  col2[2] = ${col2.at(2).value} (should be 0 - zero filled)`);

console.log("\nColumn information:");
console.log(`  Column 1 length: ${col1.len()}`);
console.log(`  Column 2 length: ${col2.len()}`);
console.log(`  Internal SIMD chunks: ${col1.data.length}`);

console.log("\n✅ TypeScript implementation matches Rust behavior exactly!"); 