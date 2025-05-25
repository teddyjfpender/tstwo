import { M31 } from "./packages/core/src/fields/m31";
import { fft } from "./packages/core/src/backend/simd/fft/rfft";
import { ifftLowerWithVecwise } from "./packages/core/src/backend/simd/fft/ifft";
import { getTwiddleDbls, getITwiddleDbls } from "./packages/core/src/backend/simd/fft";
import { CanonicCoset } from "./packages/core/src/circle";

console.log("=== LAYER 5 DEBUG ===");

const log_size = 6;
const size = 1 << log_size;

// Create simple test data
const original = Array.from({ length: size }, (_, i) => M31.from((i * 7 + 3) % 1000));
const src = original.map(v => v.value);
const dst = new Array(size).fill(0);

console.log("Original data (first 8):", original.slice(0, 8).map(v => v.value));

// Create coset and twiddles
const canonicCoset = new CanonicCoset(log_size);
const domain = canonicCoset.circleDomain();
const fftTwiddles = getTwiddleDbls(domain.half_coset);
const ifftTwiddles = getITwiddleDbls(domain.half_coset);

// Forward FFT
fft(src, dst, fftTwiddles, log_size);
console.log("After FFT (first 8):", dst.slice(0, 8));

// Now let's manually do the IFFT step by step
console.log("\n--- Manual IFFT step by step ---");

// Step 1: Apply ifftLowerWithVecwise (this should handle layers 0-4 via vecwise, then layer 5)
const beforeIFFT = [...dst];
ifftLowerWithVecwise(dst, ifftTwiddles, log_size, log_size);
console.log("After ifftLowerWithVecwise (first 8):", dst.slice(0, 8));

// Check what we expect vs what we get
const scale = M31.from(size);
console.log("\nScale factor:", scale.value);

for (let i = 0; i < 8; i++) {
  const expected = original[i]!.mul(scale);
  const actual = M31.fromUnchecked(dst[i]!);
  const correct = actual.value === expected.value;
  console.log(`Index ${i}: original=${original[i]!.value}, expected=${expected.value}, actual=${actual.value}, correct=${correct}`);
} 