import { Coset } from './packages/core/src/circle';
import { M31 } from './packages/core/src/fields/m31';

const coset = Coset.subgroup(5);
console.log('Coset size:', coset.size());
console.log('First few points:');
for (let i = 0; i < Math.min(8, coset.size()); i++) {
  const point = coset.at(i);
  console.log(`Point ${i}: x=${point.x.value}, y=${point.y.value}`);
  if (point.x.value === 0) {
    console.log(`Found zero x-coordinate at index ${i}!`);
  }
}

// Test the half coset too
const halfCoset = coset.double();
console.log('\nHalf coset size:', halfCoset.size());
console.log('First few half coset points:');
for (let i = 0; i < Math.min(8, halfCoset.size()); i++) {
  const point = halfCoset.at(i);
  console.log(`Point ${i}: x=${point.x.value}, y=${point.y.value}`);
  if (point.x.value === 0) {
    console.log(`Found zero x-coordinate at index ${i}!`);
  }
} 