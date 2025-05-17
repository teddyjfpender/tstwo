import { M31, P } from "../../src/fields/m31";
import { CM31 } from "../../src/fields/cm31";

// Helper functions
function cm31(m0: number, m1: number): CM31 {
  return CM31.fromUnchecked(m0, m1);
}

// Calculate inverse of CM31(1, 2) using manual steps

// 1. Manually calculate for 1/5 mod P 
// Using Fermat's Little Theorem: 5^(P-2) mod P
console.log("P =", P);
console.log("For 1/5 mod P, we need 5^(P-2) mod P");

// Since calculating 5^(P-2) directly would be too large,
// we use the extended Euclidean algorithm to find modular inverse
function modInverse(a: number, m: number): number {
  if (m === 1) return 0;
  
  let m0 = m;
  let y = 0;
  let x = 1;
  
  while (a > 1) {
    // q is quotient
    let q = Math.floor(a / m);
    let t = m;
    
    // m is remainder now, process same as Euclid's algorithm
    m = a % m;
    a = t;
    t = y;
    
    // Update x and y
    y = x - q * y;
    x = t;
  }
  
  // Make x positive
  if (x < 0) x += m0;
  
  return x;
}

const inverse5 = modInverse(5, P);
console.log("1/5 mod P =", inverse5);

// Now calculate (1-2i)/5 = (1/5) - (2/5)i
const realPart = inverse5;
const imagPart = (P - 2 * inverse5) % P;

console.log("realPart =", realPart);
console.log("imagPart =", imagPart);

// Create the inverse CM31 directly
const cmInv = cm31(realPart, imagPart);

// Verify by multiplication
const cm = cm31(1, 2);
const product = cm.mul(cmInv);

console.log("\nVerification:");
console.log("(1+2i) * ((1/5)-(2/5)i) should be 1+0i");
console.log("result.real =", product.real.value);
console.log("result.imag =", product.imag.value); 