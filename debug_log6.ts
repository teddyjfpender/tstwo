import { M31 } from "./packages/core/src/fields/m31";
import { fft } from "./packages/core/src/backend/simd/fft/rfft";
import { ifft } from "./packages/core/src/backend/simd/fft/ifft";
import { getTwiddleDbls, getITwiddleDbls } from "./packages/core/src/backend/simd/fft";
import { CanonicCoset } from "./packages/core/src/circle";

console.log("=== LOG_SIZE=6 DEBUG ===");

// Test the failing case: log_size=6 (64 elements)
const log_size = 6;
const size = 1 << log_size;

console.log(`Testing log_size=${log_size}, size=${size}`);

// Create coset and twiddles
const canonicCoset = new CanonicCoset(log_size);
const domain = canonicCoset.circleDomain();

console.log("Domain info:");
console.log("  domain.logSize():", domain.logSize());
console.log("  domain.half_coset.logSize():", domain.half_coset.logSize());
console.log("  domain.half_coset.size():", domain.half_coset.size());

const fftTwiddles = getTwiddleDbls(domain.half_coset);
const ifftTwiddles = getITwiddleDbls(domain.half_coset);

console.log("Twiddle structure:");
console.log("  Number of twiddle arrays:", fftTwiddles.length);
for (let i = 0; i < fftTwiddles.length; i++) {
  console.log(`  Layer ${i}: ${fftTwiddles[i]!.length} twiddles`);
}

// The issue is that we're calling fft with log_size=6, but twiddles are for log_size=5
// Let's see what happens if we call fft with the correct log_size
const correct_log_size = domain.half_coset.logSize();
console.log(`\nCalling FFT with correct log_size=${correct_log_size} instead of ${log_size}`);

// Create test data
const original = Array.from({ length: size }, (_, i) => M31.from((i * 7 + 3) % 1000));
const src = original.map(v => v.value);
const dst = new Array(size).fill(0);

console.log("Original (first 8):", original.slice(0, 8).map(v => v.value));

try {
  // Forward FFT with log_size - 1 (matching the twiddle structure)
  const fft_log_size = log_size - 1;
  console.log(`\n=== FORWARD FFT with log_size=${fft_log_size} ===`);
  fft(src, dst, fftTwiddles, fft_log_size);
  console.log("FFT result (first 8):", dst.slice(0, 8));

  // Inverse FFT
  console.log("\n=== INVERSE FFT ===");
  ifft(dst, ifftTwiddles, fft_log_size);
  console.log("IFFT result (first 8):", dst.slice(0, 8));

  // Check scaling
  console.log("\n=== SCALING CHECK ===");
  const scale = M31.from(1 << fft_log_size);
  console.log("Expected scaling factor:", 1 << fft_log_size);

  for (let i = 0; i < 8; i++) {
    const expected = original[i]!.mul(scale);
    const actual = M31.fromUnchecked(dst[i]!);
    const ratio = actual.value / expected.value;
    console.log(`[${i}]: original=${original[i]!.value}, expected=${expected.value}, actual=${actual.value}, ratio=${ratio}`);
  }
} catch (error: unknown) {
  console.error("Error:", (error as Error).message);
}

// Test with impulse for log_size=6
console.log("\n=== IMPULSE TEST FOR LOG_SIZE=6 ===");
const impulse = new Array(size).fill(0);
impulse[0] = 1;

const impulseResult = new Array(size).fill(0);
fft(impulse, impulseResult, fftTwiddles, log_size);
console.log("Impulse FFT (first 8):", impulseResult.slice(0, 8));

// Check if all values are the same (they should be for impulse)
const allSame = impulseResult.every(v => v === impulseResult[0]);
console.log("All FFT values same?", allSame, "(expected: true for impulse)");

ifft(impulseResult, ifftTwiddles, log_size);
console.log("Impulse IFFT (first 8):", impulseResult.slice(0, 8));
console.log("Expected: [64, 0, 0, 0, ...]");

const impulseScaling = impulseResult[0]! / size;
console.log(`Impulse scaling: expected=1, actual=${impulseScaling}`);

// Simple test with log_size=6 and correct array size
console.log("\n=== SIMPLE FFT TEST WITH CORRECT SIZE ===");
const simple_src_64 = new Array(64).fill(0);
simple_src_64[0] = 1; // Impulse
const simple_dst_64 = new Array(64).fill(0);

try {
  fft(simple_src_64, simple_dst_64, fftTwiddles, 6);
  console.log("Success! Result (first 8):", simple_dst_64.slice(0, 8));
} catch (error: unknown) {
  console.error("Error:", (error as Error).message);
  console.error("Stack:", (error as Error).stack);
}

// Test IFFT separately
console.log("\n=== IFFT TEST ===");
const fft_result = [1924811976, 0, 0, 0, 0, 0, 0, 0, ...new Array(56).fill(0)];
const ifft_input = [...fft_result];

try {
  ifft(ifft_input, ifftTwiddles, 6);
  console.log("IFFT Success! Result (first 8):", ifft_input.slice(0, 8));
  console.log("Expected: [64, 0, 0, 0, ...]");
  console.log("Scaling factor:", ifft_input[0]! / 64);
} catch (error: unknown) {
  console.error("IFFT Error:", (error as Error).message);
  console.error("Stack:", (error as Error).stack);
} 