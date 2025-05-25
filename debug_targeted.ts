import { M31 } from "./packages/core/src/fields/m31";
import { PackedM31 } from "./packages/core/src/backend/simd/m31";
import { simdButterfly, getTwiddleDbls, fft } from "./packages/core/src/backend/simd/fft/rfft";
import { simdIButterfly, getITwiddleDbls, ifft } from "./packages/core/src/backend/simd/fft/ifft";
import { CanonicCoset } from "./packages/core/src/circle";

// Test with the minimum FFT size first
const MIN_FFT_LOG_SIZE = 5;

console.log("Testing minimum FFT size:", MIN_FFT_LOG_SIZE);

const log_size = MIN_FFT_LOG_SIZE;
const size = 1 << log_size;

console.log("Size:", size);

// Test with a simple pattern: [1, 0, 0, 0, ...]
const simple = new Array(size).fill(0);
simple[0] = 1; // Only first element is 1

console.log("Testing with impulse [1, 0, 0, ...]");
console.log("Original:", simple.slice(0, 8));

const canonicCoset = new CanonicCoset(log_size);
const domain = canonicCoset.circleDomain();
const twiddles = getTwiddleDbls(domain.half_coset);
const itwiddles = getITwiddleDbls(domain.half_coset);

// Forward FFT
const fft_result = new Array(size).fill(0);
fft(simple, fft_result, twiddles, log_size);
console.log("After FFT:", fft_result.slice(0, 8));

// Inverse FFT
ifft(fft_result, itwiddles, log_size);
console.log("After IFFT:", fft_result.slice(0, 8));

console.log("Expected: [32, 0, 0, 0, ...]");
console.log("Scaling factors:");
for (let i = 0; i < 8; i++) {
  const expected = simple[i]! * size;
  const actual = fft_result[i]!;
  console.log(`  [${i}]: expected ${expected}, actual ${actual}, ratio ${actual / expected}`);
}

// Test with [1, 1, 1, 1, ...]
console.log("\nTesting with all ones:");
const ones = new Array(size).fill(1);
const ones_fft = new Array(size).fill(0);

fft(ones, ones_fft, twiddles, log_size);
console.log("FFT of all ones (first 8):", ones_fft.slice(0, 8));

ifft(ones_fft, itwiddles, log_size);
console.log("IFFT result (first 8):", ones_fft.slice(0, 8));

console.log("Expected: all 32s");
console.log("Scaling factors:");
for (let i = 0; i < 8; i++) {
  const expected = size; // 1 * size
  const actual = ones_fft[i]!;
  console.log(`  [${i}]: expected ${expected}, actual ${actual}, ratio ${actual / expected}`);
}

// Test with alternating pattern [1, -1, 1, -1, ...]
console.log("\nTesting with alternating [1, -1, 1, -1, ...]:");
const alternating = new Array(size).fill(0);
for (let i = 0; i < size; i++) {
  alternating[i] = (i % 2 === 0) ? 1 : M31.from(-1).value;
}

console.log("Original (first 8):", alternating.slice(0, 8));

const alt_fft = new Array(size).fill(0);
fft(alternating, alt_fft, twiddles, log_size);
console.log("FFT result (first 8):", alt_fft.slice(0, 8));

ifft(alt_fft, itwiddles, log_size);
console.log("IFFT result (first 8):", alt_fft.slice(0, 8));

console.log("Expected scaling factors:");
for (let i = 0; i < 8; i++) {
  const original = M31.fromUnchecked(alternating[i]!);
  const expected = original.mul(M31.from(size));
  const actual = M31.fromUnchecked(alt_fft[i]!);
  console.log(`  [${i}]: original ${original.value}, expected ${expected.value}, actual ${actual.value}, ratio ${actual.value / expected.value}`);
} 