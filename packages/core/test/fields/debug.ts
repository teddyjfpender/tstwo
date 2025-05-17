import { M31, P } from "../../src/fields/m31";
import { CM31 } from "../../src/fields/cm31";

// Helper functions
function cm31(m0: number, m1: number): CM31 {
  return CM31.fromUnchecked(m0, m1);
}

// Debug multiplication
const cm0 = cm31(1, 2);
const cm1 = cm31(4, 5);
const result = cm0.mul(cm1);
console.log("Expected:", P - 6, 18);
console.log("Actual real:", result.real.value);
console.log("Actual imag:", result.imag.value);

// Debug inverse
const cm = cm31(1, 2);
const cmInv = cm.inverse();
const product = cm.mul(cmInv);
console.log("\nInverse test:");
console.log("Expected: 1, 0");
console.log("Actual:", product.real.value, product.imag.value); 