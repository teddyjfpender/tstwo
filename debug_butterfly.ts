import { M31 } from "./packages/core/src/fields/m31";
import { PackedM31 } from "./packages/core/src/backend/simd/m31";
import { simdButterfly, getTwiddleDbls, fft } from "./packages/core/src/backend/simd/fft/rfft";
import { simdIButterfly, getITwiddleDbls, ifft } from "./packages/core/src/backend/simd/fft/ifft";
import { CanonicCoset } from "./packages/core/src/circle";

// Test mulDoubled function
const val = M31.from(18); // val1_array[1] = 18
const twiddle = M31.from(10); // twiddle_array[1] = (1 * 3 + 7) % 100 = 10
const twiddle_dbl = twiddle.value * 2; // 20

console.log("val:", val.value);
console.log("twiddle:", twiddle.value);
console.log("twiddle_dbl:", twiddle_dbl);

// Ground truth: val * twiddle
const ground_truth = val.mul(twiddle);
console.log("Ground truth (val * twiddle):", ground_truth.value);

// SIMD version: mulDoubled with doubled twiddle
const packed_val = PackedM31.fromArray([val].concat(Array(15).fill(M31.zero())));
const result = PackedM31.mulDoubled(packed_val, [twiddle_dbl].concat(Array(15).fill(0)));
console.log("SIMD result (mulDoubled):", result.at(0).value);

// Expected: they should be equal
console.log("Match:", ground_truth.value === result.at(0).value);

// Test the full butterfly calculation for lane 1
const val0 = M31.from(2); // val0_array[1] = 2
const val1 = M31.from(18); // val1_array[1] = 18

console.log("\nFull butterfly test for lane 1:");
console.log("val0:", val0.value);
console.log("val1:", val1.value);
console.log("twiddle:", twiddle.value);

// Ground truth butterfly: tmp = v1 * twiddle; new_v0 = v0 + tmp; new_v1 = v0 - tmp
const tmp = val1.mul(twiddle);
const expected_v0 = val0.add(tmp);
const expected_v1 = val0.sub(tmp);

console.log("tmp (v1 * twiddle):", tmp.value);
console.log("expected_v0 (v0 + tmp):", expected_v0.value);
console.log("expected_v1 (v0 - tmp):", expected_v1.value);

// Simple test
const val0_simple = PackedM31.fromArray([M31.from(17)].concat(Array(15).fill(M31.zero())));
const val1_simple = PackedM31.fromArray([M31.from(17)].concat(Array(15).fill(M31.zero())));

console.log("Original val0[0]:", val0_simple.at(0).value);
console.log("Original val1[0]:", val1_simple.at(0).value);

// Create a proper twiddle
const testCoset = new CanonicCoset(5);
const domain = testCoset.circleDomain();
const twiddles = getTwiddleDbls(domain.half_coset);
const itwiddles = getITwiddleDbls(domain.half_coset);

const twiddle_dbl_simple = Array(16).fill(twiddles[0]![0]!);
const itwiddle_dbl_simple = Array(16).fill(itwiddles[0]![0]!);

console.log("Twiddle:", twiddles[0]![0]!);
console.log("ITwiddle:", itwiddles[0]![0]!);

// Forward butterfly
const [result0, result1] = simdButterfly(val0_simple, val1_simple, twiddle_dbl_simple);
console.log("After forward butterfly:");
console.log("result0[0]:", result0.at(0).value);
console.log("result1[0]:", result1.at(0).value);

// Inverse butterfly
const [inv0, inv1] = simdIButterfly(result0, result1, itwiddle_dbl_simple);
console.log("After inverse butterfly:");
console.log("inv0[0]:", inv0.at(0).value);
console.log("inv1[0]:", inv1.at(0).value);

console.log("Expected (2x original):", val0_simple.at(0).double().value);
console.log("Actual scaling factor:", inv0.at(0).value / val0_simple.at(0).value);

// Test simple FFT/IFFT round trip
const log_size = 5; // 32 elements
const size = 1 << log_size;

console.log("Testing FFT/IFFT round trip with log_size =", log_size, "size =", size);

// Create simple test data
const original = Array.from({ length: size }, (_, i) => M31.from(i + 1).value);
console.log("Original data (first 8):", original.slice(0, 8));

// Create coset and twiddles
const fftCanonic = new CanonicCoset(log_size);
const fftDomain = fftCanonic.circleDomain();
const fftTwiddles = getTwiddleDbls(fftDomain.half_coset);
const fftItwiddles = getITwiddleDbls(fftDomain.half_coset);

console.log("Twiddle arrays count:", fftTwiddles.length);
console.log("First twiddle array length:", fftTwiddles[0]?.length);

// Forward FFT
const fft_result = new Array(size).fill(0);
fft(original, fft_result, fftTwiddles, log_size);
console.log("After FFT (first 8):", fft_result.slice(0, 8));

// Inverse FFT
ifft(fft_result, fftItwiddles, log_size);
console.log("After IFFT (first 8):", fft_result.slice(0, 8));

// Check scaling
console.log("Expected scaling factor:", size);
console.log("Actual scaling factors (first 8):");
for (let i = 0; i < 8; i++) {
  const expected = original[i]!;
  const actual = fft_result[i]!;
  const scaling = actual / expected;
  console.log(`  [${i}]: ${expected} -> ${actual} (scale: ${scaling})`);
} 