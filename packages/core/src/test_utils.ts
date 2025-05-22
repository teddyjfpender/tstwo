// Ported helpers from Rust test_utils.rs
import { Blake2sChannel } from './channel/blake2';
import type { CpuCircleEvaluation } from './backend/cpu';
import type { M31 } from './fields/m31';
import { QM31 as SecureField } from './fields/qm31';

export function secureEvalToBaseEval<EvalOrder>(
  eval_: CpuCircleEvaluation<SecureField, EvalOrder>,
): CpuCircleEvaluation<M31, EvalOrder> {
  const values = eval_.values.map((x) => x.toM31Array()[0]);
  return new (eval_.constructor as any)(eval_.domain, values);
}

export function test_channel(): Blake2sChannel {
  return new Blake2sChannel();
}

/*
Original Rust reference for context:
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
