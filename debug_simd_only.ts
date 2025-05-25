import { M31 } from "./packages/core/src/fields/m31";
import { PackedM31 } from "./packages/core/src/backend/simd/m31";
import { simdButterfly } from "./packages/core/src/backend/simd/fft/rfft";
import { simdIButterfly } from "./packages/core/src/backend/simd/fft/ifft";

console.log("Testing SIMD butterfly operations in isolation");

// Test with simple values
const val0 = PackedM31.fromArray(Array.from({ length: 16 }, (_, i) => M31.from(i + 1)));
const val1 = PackedM31.fromArray(Array.from({ length: 16 }, (_, i) => M31.from(i + 17)));

console.log("Original val0:", val0.toArray().slice(0, 8).map(v => v.value));
console.log("Original val1:", val1.toArray().slice(0, 8).map(v => v.value));

// Create simple twiddle (all ones doubled)
const twiddle_dbl = Array(16).fill(M31.from(1).value * 2);

console.log("Twiddle (doubled):", twiddle_dbl[0]);

// Forward butterfly
const [fwd0, fwd1] = simdButterfly(val0, val1, twiddle_dbl);
console.log("After forward butterfly:");
console.log("fwd0:", fwd0.toArray().slice(0, 8).map(v => v.value));
console.log("fwd1:", fwd1.toArray().slice(0, 8).map(v => v.value));

// Inverse butterfly (using inverse twiddle)
const itwiddle_dbl = Array(16).fill(M31.from(1).inverse().value * 2);
console.log("Inverse twiddle (doubled):", itwiddle_dbl[0]);

const [inv0, inv1] = simdIButterfly(fwd0, fwd1, itwiddle_dbl);
console.log("After inverse butterfly:");
console.log("inv0:", inv0.toArray().slice(0, 8).map(v => v.value));
console.log("inv1:", inv1.toArray().slice(0, 8).map(v => v.value));

console.log("Expected scaling factor: 2 (from butterfly + inverse butterfly)");
console.log("Scaling factors:");
for (let i = 0; i < 8; i++) {
  const orig0 = val0.at(i).value;
  const orig1 = val1.at(i).value;
  const result0 = inv0.at(i).value;
  const result1 = inv1.at(i).value;
  
  console.log(`  Lane ${i}: orig0=${orig0} -> result0=${result0} (scale: ${result0/orig0})`);
  console.log(`  Lane ${i}: orig1=${orig1} -> result1=${result1} (scale: ${result1/orig1})`);
}

// Test with all ones
console.log("\nTesting with all ones:");
const ones0 = PackedM31.broadcast(M31.from(1));
const ones1 = PackedM31.broadcast(M31.from(1));

console.log("Original ones0:", ones0.at(0).value);
console.log("Original ones1:", ones1.at(0).value);

const [fwd_ones0, fwd_ones1] = simdButterfly(ones0, ones1, twiddle_dbl);
console.log("After forward butterfly:");
console.log("fwd_ones0:", fwd_ones0.at(0).value);
console.log("fwd_ones1:", fwd_ones1.at(0).value);

const [inv_ones0, inv_ones1] = simdIButterfly(fwd_ones0, fwd_ones1, itwiddle_dbl);
console.log("After inverse butterfly:");
console.log("inv_ones0:", inv_ones0.at(0).value);
console.log("inv_ones1:", inv_ones1.at(0).value);

console.log("Expected: 2 (scaling factor)");
console.log("Actual scaling factors:");
console.log(`  ones0: ${inv_ones0.at(0).value / ones0.at(0).value}`);
console.log(`  ones1: ${inv_ones1.at(0).value / ones1.at(0).value}`); 