import { M31 } from "./packages/core/src/fields/m31";
import { fft } from "./packages/core/src/backend/simd/fft/rfft";
import { ifft } from "./packages/core/src/backend/simd/fft/ifft";
import { getTwiddleDbls, getITwiddleDbls } from "./packages/core/src/backend/simd/fft";
import { CanonicCoset } from "./packages/core/src/circle";

console.log("=== MINIMAL FFT DEBUG ===");

// Use the absolute minimum FFT size
const log_size = 5; // 32 elements
const size = 1 << log_size;

console.log(`Testing log_size=${log_size}, size=${size}`);

// Test with the simplest possible input: [1, 0, 0, 0, ...]
const input = new Array(size).fill(0);
input[0] = 1;

console.log("Input:", input.slice(0, 8));

// Create coset and twiddles
const canonicCoset = new CanonicCoset(log_size);
const domain = canonicCoset.circleDomain();
const fftTwiddles = getTwiddleDbls(domain.half_coset);
const ifftTwiddles = getITwiddleDbls(domain.half_coset);

console.log("Twiddle structure:");
console.log("  Number of twiddle arrays:", fftTwiddles.length);
for (let i = 0; i < fftTwiddles.length; i++) {
  console.log(`  Layer ${i}: ${fftTwiddles[i]!.length} twiddles`);
}

// Forward FFT
const fftResult = new Array(size).fill(0);
console.log("\n=== FORWARD FFT ===");
fft(input, fftResult, fftTwiddles, log_size);
console.log("FFT result:", fftResult.slice(0, 8));

// Check if FFT result makes sense (should be all the same for impulse input)
const allSame = fftResult.every(v => v === fftResult[0]);
console.log("All FFT values same?", allSame, "(expected: true for impulse)");

// Inverse FFT
console.log("\n=== INVERSE FFT ===");
ifft(fftResult, ifftTwiddles, log_size);
console.log("IFFT result:", fftResult.slice(0, 8));

// Check scaling
console.log("\n=== SCALING CHECK ===");
console.log("Expected: [32, 0, 0, 0, ...]");
console.log("Actual:  ", fftResult.slice(0, 8));

const expectedFirst = size; // Should be scaled by size
const actualFirst = fftResult[0]!;
const scalingRatio = actualFirst / expectedFirst;

console.log(`First element: expected=${expectedFirst}, actual=${actualFirst}, ratio=${scalingRatio}`);

// Check if other elements are zero (they should be for impulse input)
const otherElementsZero = fftResult.slice(1).every(v => v === 0);
console.log("Other elements zero?", otherElementsZero, "(expected: true for impulse)");

// Test with a different simple input: [1, 1, 0, 0, ...]
console.log("\n=== TESTING [1, 1, 0, 0, ...] ===");
const input2 = new Array(size).fill(0);
input2[0] = 1;
input2[1] = 1;

const fftResult2 = new Array(size).fill(0);
fft(input2, fftResult2, fftTwiddles, log_size);
console.log("FFT result:", fftResult2.slice(0, 8));

ifft(fftResult2, ifftTwiddles, log_size);
console.log("IFFT result:", fftResult2.slice(0, 8));
console.log("Expected: [32, 32, 0, 0, ...]");

const scaling0 = fftResult2[0]! / size;
const scaling1 = fftResult2[1]! / size;
console.log(`Scaling factors: [0]=${scaling0}, [1]=${scaling1}`); 