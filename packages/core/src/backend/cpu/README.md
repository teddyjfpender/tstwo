# CPU Backend

This directory hosts the TypeScript port of the original `backend/cpu` Rust
module.  The CPU backend provides a reference implementation of various back-end
traits used throughout the library such as Merkle hashing, polynomial
manipulation and proof-of-work.  Many files currently expose only lightweight
stubs – the commented Rust remains in place for future reference.

```
backend/cpu/
├─ accumulation.ts
├─ blake2.ts
├─ circle.ts
├─ fri.ts
├─ grind.ts
├─ index.ts
└─ quotients.ts
```

The most functional component today is `index.ts`, exposing the `CpuBackend`
class and `bitReverse` helper.  Bit reversal is commonly required when working
with FFTs.  Given an array of eight elements the reordering performed by
`bitReverse` is illustrated below:

```
index: 0 1 2 3 4 5 6 7
rev:   0 4 2 6 1 5 3 7
```

```
 before        after
+---+---+---+   +---+---+---+
|0|1|2|3|   =>  |0|4|2|6|
|4|5|6|7|        |1|5|3|7|
+---+---+---+   +---+---+---+
```

Further modules will be fleshed out as the port progresses.  Run `bun test` to
execute the accompanying unit tests.
