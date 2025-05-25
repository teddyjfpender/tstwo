import { M31 } from "./packages/core/src/fields/m31";
import { fft } from "./packages/core/src/backend/simd/fft/rfft";
import { ifft } from "./packages/core/src/backend/simd/fft/ifft";
import { getTwiddleDbls, getITwiddleDbls } from "./packages/core/src/backend/simd/fft";
import { CanonicCoset } from "./packages/core/src/circle";

console.log("=== COMPARISON TEST: log_size=5 vs log_size=6 ===");

for (const log_size of [5, 6]) {
  console.log(`\n--- Testing log_size=${log_size} ---`);
  const size = 1 << log_size;

  // Create the exact same test data as the failing test
  const original = Array.from({ length: size }, (_, i) => M31.from((i * 7 + 3) % 1000));
  const src = original.map(v => v.value);
  const dst = new Array(size).fill(0);

  console.log("Original data (first 4):", original.slice(0, 4).map(v => v.value));

  // Create coset and twiddles
  const canonicCoset = new CanonicCoset(log_size);
  const domain = canonicCoset.circleDomain();
  const fftTwiddles = getTwiddleDbls(domain.half_coset);
  const ifftTwiddles = getITwiddleDbls(domain.half_coset);

  // Forward FFT
  fft(src, dst, fftTwiddles, log_size);
  console.log("FFT result (first 4):", dst.slice(0, 4));

  // Inverse FFT
  ifft(dst, ifftTwiddles, log_size);
  console.log("IFFT result (first 4):", dst.slice(0, 4));

  // Check what we expect vs what we get
  const scale = M31.from(size);
  console.log("Scale factor:", scale.value);

  let allCorrect = true;
  for (let i = 0; i < Math.min(4, size); i++) {
    const expected = original[i]!.mul(scale);
    const actual = M31.fromUnchecked(dst[i]!);
    const correct = actual.value === expected.value;
    console.log(`Index ${i}: original=${original[i]!.value}, expected=${expected.value}, actual=${actual.value}, correct=${correct}`);
    if (!correct) allCorrect = false;
  }
  
  console.log(`Overall result for log_size=${log_size}: ${allCorrect ? "✅ PASS" : "❌ FAIL"}`);
} 