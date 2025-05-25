import { CanonicCoset } from "./packages/core/src/circle";
import { getITwiddleDbls } from "./packages/core/src/backend/simd/fft";

console.log("=== TWIDDLE STRUCTURE DEBUG ===");

for (const log_size of [5, 6]) {
  console.log(`\nFor log_size=${log_size}:`);
  const canonicCoset = new CanonicCoset(log_size);
  const domain = canonicCoset.circleDomain();
  const itwiddle_dbl = getITwiddleDbls(domain.half_coset);

  console.log(`domain.half_coset.logSize() = ${domain.half_coset.logSize()}`);
  console.log(`Number of twiddle arrays: ${itwiddle_dbl.length}`);
  
  for (let i = 0; i < itwiddle_dbl.length; i++) {
    console.log(`  Layer ${i}: ${itwiddle_dbl[i]!.length} twiddles`);
    if (itwiddle_dbl[i]!.length <= 4) {
      console.log(`    Values: [${itwiddle_dbl[i]!.join(', ')}]`);
    }
  }
}

console.log('\nEngineering manager expects:');
console.log('Layer 0-4: handled by ifftVecwiseLoop');
console.log('Layer 5: handled by ifft1Loop with twiddle_dbl[5]');
console.log('But we only have twiddle arrays 0-4!');

console.log('\nMaybe the issue is that we need 6 twiddle arrays for log_size=6?');
console.log('Let me check what the half_coset size should be...');
console.log(`domain.size() = ${domain.size()}`);
console.log(`domain.half_coset.size() = ${domain.half_coset.size()}`);

// Check if we should be generating more twiddle arrays
console.log('\nChecking twiddle generation logic...');
console.log('getITwiddleDbls iterates for coset.logSize() times');
console.log(`half_coset.logSize() = ${domain.half_coset.logSize()}`);
console.log('So we generate 5 arrays for indices 0-4');
console.log('But layer 5 needs twiddle_dbl[5] which does not exist!'); 