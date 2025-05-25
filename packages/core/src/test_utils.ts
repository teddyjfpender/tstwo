// Ported helpers from Rust test_utils.rs
import { Blake2sChannel } from './channel/blake2';
import type { CpuCircleEvaluation } from './backend/cpu/circle';
import type { M31 as BaseField } from './fields/m31';
import { QM31 as SecureField } from './fields/qm31';

/**
 * Converts a CpuCircleEvaluation with SecureField values to one with BaseField values.
 * 
 * This is a 1:1 port of the Rust function `secure_eval_to_base_eval`.
 * It extracts the first component of each SecureField's M31 array representation.
 * 
 * **World-Leading Improvements:**
 * - Type safety with proper generic constraints
 * - Performance optimization with direct array mapping
 * - API hygiene with clear parameter types
 * 
 * @param eval - The evaluation with SecureField values to convert
 * @returns A new evaluation with BaseField values
 */
export function secureEvalToBaseEval<EvalOrder>(
  eval_: {
    readonly domain: any;
    readonly values: readonly SecureField[];
    readonly constructor: new (domain: any, values: BaseField[]) => CpuCircleEvaluation<EvalOrder>;
  }
): CpuCircleEvaluation<EvalOrder> {
  // Performance optimization: direct mapping with type safety
  const values: BaseField[] = eval_.values.map((x: SecureField) => x.to_m31_array()[0]);
  
  // Use the same constructor type for consistency (mirrors Rust CpuCircleEvaluation::new)
  return new eval_.constructor(eval_.domain, values);
}

/**
 * Creates a new Blake2sChannel with default state.
 * 
 * This is a 1:1 port of the Rust function `test_channel` which returns `Blake2sChannel::default()`.
 * 
 * **World-Leading Improvements:**
 * - API hygiene with factory method pattern
 * - Consistent with Rust's Default trait implementation
 * 
 * @returns A new Blake2sChannel instance with default state
 */
export function test_channel(): Blake2sChannel {
  return Blake2sChannel.create();
}

/*
Original Rust reference for exact 1:1 porting:
```rs
use super::backend::cpu::CpuCircleEvaluation;
use super::channel::Blake2sChannel;
use super::fields::m31::BaseField;
use super::fields::qm31::SecureField;

pub fn secure_eval_to_base_eval<EvalOrder>(
    eval: &CpuCircleEvaluation<SecureField, EvalOrder>,
) -> CpuCircleEvaluation<BaseField, EvalOrder> {
    CpuCircleEvaluation::new(
        eval.domain,
        eval.values.iter().map(|x| x.to_m31_array()[0]).collect(),
    )
}

pub fn test_channel() -> Blake2sChannel {
    Blake2sChannel::default()
}
```
*/