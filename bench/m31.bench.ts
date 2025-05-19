import { performance } from 'node:perf_hooks';
import { writeFileSync } from 'fs';
import { M31 } from '../packages/core/src/fields/m31';

const iterations = 10000;
const runs = 100;

const results: number[] = [];
for (let r = 0; r < runs; r++) {
  let acc = M31.one();
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    acc = acc.mul(M31.from(123456));
  }
  results.push(performance.now() - start);
}

const avg = results.reduce((a, b) => a + b, 0) / runs;
const opsPerSec = (iterations / (avg / 1000)).toFixed(2);
console.log(`M31.mul x${iterations} avg: ${avg.toFixed(2)}ms (${opsPerSec} ops/s)`);
writeFileSync('bench/results.json', JSON.stringify({ avgMs: avg, opsPerSec }));
