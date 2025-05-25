import { CanonicCoset } from "./packages/core/src/circle";
import { getITwiddleDbls, getTwiddleDbls } from "./packages/core/src/backend/simd/fft";

console.log("=== DOMAIN STRUCTURE DEBUG ===");

const log_size = 6;
const canonicCoset = new CanonicCoset(log_size);
const domain = canonicCoset.circleDomain();

console.log(`log_size = ${log_size}`);
console.log(`domain.size() = ${domain.size()}`);
console.log(`domain.logSize() = ${domain.logSize()}`);
console.log(`domain.half_coset.size() = ${domain.half_coset.size()}`);
console.log(`domain.half_coset.logSize() = ${domain.half_coset.logSize()}`);

console.log('\n=== TWIDDLE GENERATION ===');
const fftTwiddles = getTwiddleDbls(domain.half_coset);
const ifftTwiddles = getITwiddleDbls(domain.half_coset);

console.log(`FFT twiddles: ${fftTwiddles.length} arrays`);
console.log(`IFFT twiddles: ${ifftTwiddles.length} arrays`);

for (let i = 0; i < ifftTwiddles.length; i++) {
  console.log(`  Layer ${i}: ${ifftTwiddles[i]!.length} twiddles`);
}

console.log('\n=== LAYER ANALYSIS ===');
console.log('For log_size=6, we have 6 layers (0-5)');
console.log('VECWISE_FFT_BITS = 5, so layers 0-4 are handled by vecwise');
console.log('Layer 5 is handled by the post-vecwise loop');
console.log('');
console.log('If layer 5 needs its own twiddles, we should have 6 twiddle arrays');
console.log('But we only have 5 twiddle arrays');
console.log('');
console.log('Maybe layer 5 should use the same twiddles as layer 4?');
console.log('Or maybe we should generate twiddles from the full domain, not half_coset?');

console.log('\n=== FULL DOMAIN TEST ===');
const fullDomainTwiddles = getITwiddleDbls(domain);
console.log(`Full domain twiddles: ${fullDomainTwiddles.length} arrays`);
for (let i = 0; i < fullDomainTwiddles.length; i++) {
  console.log(`  Layer ${i}: ${fullDomainTwiddles[i]!.length} twiddles`);
} 