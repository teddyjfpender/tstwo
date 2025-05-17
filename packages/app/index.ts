import { greet, sum } from "@tstwo/core";

console.log("Hello via Bun!");
console.log(greet("Bun User"));
console.log(`Sum of 2 + 3 = ${sum(2, 3)}`);