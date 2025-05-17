import { M31, P } from "../../src/fields/m31";
import { CM31 } from "../../src/fields/cm31";

// Helper functions
function cm31(m0: number, m1: number): CM31 {
  return CM31.fromUnchecked(m0, m1);
}

// Test inverse calculation for cm31(1, 2)
const a = M31.fromUnchecked(1);
const b = M31.fromUnchecked(2);

// Calculate the norm: a^2 + b^2 = 1^2 + 2^2 = 1 + 4 = 5
const aSq = a.mul(a);
const bSq = b.mul(b);
const norm = aSq.add(bSq);

console.log("a²:", aSq.value);
console.log("b²:", bSq.value);
console.log("norm (a² + b²):", norm.value);

// Calculate 1/norm
const normInv = norm.inverse();
console.log("1/norm:", normInv.value);

// Calculate (a - bi) / (a^2 + b^2)
const realPart = a.mul(normInv);
const imagPart = b.neg().mul(normInv);

console.log("realPart:", realPart.value);
console.log("imagPart:", imagPart.value);

// Check the result by multiplying by the original complex number
const cm = cm31(1, 2);
const cmInv = new CM31(realPart, imagPart);
const product = cm.mul(cmInv);

console.log("\nCheck result by multiplying:");
console.log("cm * cmInv should be 1 + 0i");
console.log("real:", product.real.value);
console.log("imag:", product.imag.value); 