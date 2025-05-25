import { M31 } from "./packages/core/src/fields/m31";
import { CanonicCoset } from "./packages/core/src/circle";
import { fft } from "./packages/core/src/backend/simd/fft/rfft";
import { ifft, getITwiddleDbls } from "./packages/core/src/backend/simd/fft/ifft";
import { getTwiddleDbls } from "./packages/core/src/backend/simd/fft/rfft";

console.log("=== DEBUGGING IFFT1LOOP FOR LOG_SIZE=6 ===\n");

const log_size = 6;
const size = 1 << log_size; // 64

// Create test data - EXACT SAME AS THE TEST
const original = Array.from({ length: size }, (_, i) => M31.from((i * 7 + 3) % 1000));
const src = original.map(v => v.value);

console.log("Original data (first 4):", src.slice(0, 4));

// Generate twiddles
const canonicCoset = new CanonicCoset(log_size);
const domain = canonicCoset.circleDomain();
const twiddle_dbl = getTwiddleDbls(domain.half_coset);
const itwiddle_dbl = getITwiddleDbls(domain.half_coset);

console.log("\nTwiddle structure:");
console.log(`Number of twiddle arrays: ${itwiddle_dbl.length}`);
for (let i = 0; i < itwiddle_dbl.length; i++) {
  console.log(`  Layer ${i}: ${itwiddle_dbl[i]!.length} twiddles`);
  if (itwiddle_dbl[i]!.length <= 4) {
    console.log(`    Values: [${itwiddle_dbl[i]!.join(', ')}]`);
  }
}

// Forward FFT
const dst = new Array(size).fill(0);
fft(src, dst, twiddle_dbl, log_size);
console.log("\nFFT result (first 4):", dst.slice(0, 4));

// Add debug logging to see what happens in ifft1Loop
console.log("\n=== STARTING INVERSE FFT ===");

// Manually trace the ifft call to see when ifft1Loop is called
console.log("About to call ifft...");

// Before calling ifft, let's see what layer 5 would use
const VECWISE_FFT_BITS = 5; // LOG_N_LANES + 1
const fft_layers = log_size; // 6
console.log(`VECWISE_FFT_BITS = ${VECWISE_FFT_BITS}`);
console.log(`fft_layers = ${fft_layers}`);

for (let layer = VECWISE_FFT_BITS; layer < fft_layers; layer += 3) {
  const remaining = fft_layers - layer;
  console.log(`\nLayer ${layer}, remaining = ${remaining}`);
  
  if (remaining === 1) {
    console.log("This would call ifft1Loop");
    console.log(`layer = ${layer}`);
    console.log(`itwiddle_dbl.length = ${itwiddle_dbl.length}`);
    
    if (layer < itwiddle_dbl.length) {
      console.log(`Would use itwiddle_dbl[${layer}] = [${itwiddle_dbl[layer]!.join(', ')}]`);
    } else {
      console.log(`Layer ${layer} >= ${itwiddle_dbl.length}, would use fallback [[2]]`);
    }
  }
}

// Now call the actual ifft
ifft(dst, itwiddle_dbl, log_size);
console.log("\nIFFT result (first 4):", dst.slice(0, 4));

// Check scaling
const scale = M31.from(size);
console.log(`\nScale factor: ${size}`);
for (let i = 0; i < 4; i++) {
  const expected = original[i]!.value * size;
  const actual = dst[i]!;
  console.log(`Index ${i}: original=${original[i]!.value}, expected=${expected}, actual=${actual}, correct=${actual === expected}`);
} 