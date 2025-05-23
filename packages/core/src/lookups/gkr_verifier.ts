import { SumcheckError, SumcheckProof, partiallyVerify as sumcheckPartiallyVerify } from './sumcheck';
import { randomLinearCombination, eq, foldMleEvals, Fraction } from './utils';
import type { Channel } from '../channel';
import { M31 as BaseField } from '../fields/m31';
import { QM31 as SecureField } from '../fields/qm31';

/**
 * Partially verifies a batch GKR proof.
 *
 * On successful verification the function returns a `GkrArtifact` which stores the out-of-domain
 * point and claimed evaluations in the input layer columns for each instance at the OOD point.
 * These claimed evaluations are not checked in this function - hence partial verification.
 */
export function partiallyVerifyBatch(
  gateByInstance: Gate[],
  proof: GkrBatchProof,
  channel: Channel
): GkrArtifact {
  const {
    sumcheckProofs,
    layerMasksByInstance,
    outputClaimsByInstance,
  } = proof;

  if (layerMasksByInstance.length !== outputClaimsByInstance.length) {
    throw new GkrError(GkrErrorType.MalformedProof);
  }

  const nInstances = layerMasksByInstance.length;
  const instanceNLayers = (instance: number): number => layerMasksByInstance[instance]!.length;
  const nLayers = Math.max(...Array.from({ length: nInstances }, (_, i) => instanceNLayers(i)));

  if (nLayers !== sumcheckProofs.length) {
    throw new GkrError(GkrErrorType.MalformedProof);
  }

  if (gateByInstance.length !== nInstances) {
    throw new GkrError(GkrErrorType.NumInstancesMismatch, {
      given: gateByInstance.length,
      proof: nInstances,
    });
  }

  let oodPoint: SecureField[] = [];
  const claimsToVerifyByInstance: Array<SecureField[] | null> = new Array(nInstances).fill(null);

  for (let layer = 0; layer < sumcheckProofs.length; layer++) {
    const sumcheckProof = sumcheckProofs[layer]!;
    const nRemainingLayers = nLayers - layer;

    // Check for output layers.
    for (let instance = 0; instance < nInstances; instance++) {
      if (instanceNLayers(instance) === nRemainingLayers) {
        const outputClaims = outputClaimsByInstance[instance];
        if (outputClaims !== undefined) {
          claimsToVerifyByInstance[instance] = [...outputClaims];
        }
      }
    }

    // Seed the channel with layer claims.
    claimsToVerifyByInstance
      .filter((claims): claims is SecureField[] => claims !== null)
      .forEach(claims => channel.mix_felts(claims));

    const sumcheckAlpha = channel.draw_felt();
    const instanceLambda = channel.draw_felt();

    const sumcheckClaims: SecureField[] = [];
    const sumcheckInstances: number[] = [];

    // Prepare the sumcheck claim.
    for (let instance = 0; instance < claimsToVerifyByInstance.length; instance++) {
      const claimsToVerify = claimsToVerifyByInstance[instance];
      if (claimsToVerify !== null && claimsToVerify !== undefined) {
        const nUnusedVariables = nLayers - instanceNLayers(instance);
        const doublingFactor = BaseField.from(1 << nUnusedVariables);
        const claim = randomLinearCombination(claimsToVerify, instanceLambda)
          .mulM31(doublingFactor);
        sumcheckClaims.push(claim);
        sumcheckInstances.push(instance);
      }
    }

    const sumcheckClaim = randomLinearCombination(sumcheckClaims, sumcheckAlpha);
    
    let sumcheckOodPoint: SecureField[];
    let sumcheckEval: SecureField;
    try {
      [sumcheckOodPoint, sumcheckEval] = sumcheckPartiallyVerify(sumcheckClaim, sumcheckProof, channel);
    } catch (source) {
      throw new GkrError(GkrErrorType.InvalidSumcheck, { layer, source });
    }

    const layerEvals: SecureField[] = [];

    // Evaluate the circuit locally at sumcheck OOD point.
    for (const instance of sumcheckInstances) {
      const nUnused = nLayers - instanceNLayers(instance);
      const mask = layerMasksByInstance[instance]![layer - nUnused]!;
      const gate = gateByInstance[instance]!;
      
      let gateOutput: SecureField[];
      try {
        gateOutput = evaluateGate(gate, mask);
      } catch (e) {
        if (e instanceof InvalidNumMaskColumnsError) {
          const instanceLayer = instanceNLayers(layer) - nRemainingLayers;
          throw new GkrError(GkrErrorType.InvalidMask, {
            instance,
            instanceLayer,
          });
        }
        throw e;
      }
      
      // TODO: Consider simplifying the code by just using the same eq eval for all instances
      // regardless of size.
      const eqEval = eq(oodPoint.slice(nUnused), sumcheckOodPoint.slice(nUnused));
      layerEvals.push(eqEval.mul(randomLinearCombination(gateOutput, instanceLambda)));
    }

    const layerEval = randomLinearCombination(layerEvals, sumcheckAlpha);

    if (!sumcheckEval.equals(layerEval)) {
      throw new GkrError(GkrErrorType.CircuitCheckFailure, {
        claim: sumcheckEval,
        output: layerEval,
        layer,
      });
    }

    // Seed the channel with the layer masks.
    for (const instance of sumcheckInstances) {
      const nUnused = nLayers - instanceNLayers(instance);
      const mask = layerMasksByInstance[instance]![layer - nUnused]!;
      const flattenedColumns = mask.columns().flat();
      channel.mix_felts(flattenedColumns);
    }

    // Set the OOD evaluation point for layer above.
    const challenge = channel.draw_felt();
    oodPoint = [...sumcheckOodPoint];
    oodPoint.push(challenge);

    // Set the claims to verify in the layer above.
    for (const instance of sumcheckInstances) {
      const nUnused = nLayers - instanceNLayers(instance);
      const mask = layerMasksByInstance[instance]![layer - nUnused]!;
      claimsToVerifyByInstance[instance] = mask.reduceAtPoint(challenge);
    }
  }

  const finalClaimsToVerifyByInstance = claimsToVerifyByInstance.map(claims => {
    if (claims === null) {
      throw new Error('Some claims were not set during verification');
    }
    return claims;
  });

  return new GkrArtifact(
    oodPoint,
    finalClaimsToVerifyByInstance,
    Array.from({ length: nInstances }, (_, i) => instanceNLayers(i))
  );
}

/**
 * Evaluates a gate with the given mask.
 */
function evaluateGate(gate: Gate, mask: GkrMask): SecureField[] {
  switch (gate) {
    case Gate.LogUp: {
      if (mask.columns().length !== 2) {
        throw new InvalidNumMaskColumnsError();
      }

      const [numeratorA, numeratorB] = mask.columns()[0]!;
      const [denominatorA, denominatorB] = mask.columns()[1]!;

      const a = Fraction.new(numeratorA, denominatorA);
      const b = Fraction.new(numeratorB, denominatorB);
      const res = a.addSecureField(b);

      return [res.numerator, res.denominator];
    }
    case Gate.GrandProduct: {
      if (mask.columns().length !== 1) {
        throw new InvalidNumMaskColumnsError();
      }

      const [a, b] = mask.columns()[0]!;
      return [a.mul(b)];
    }
    default:
      throw new Error(`Unknown gate type: ${gate}`);
  }
}

/**
 * Batch GKR proof.
 */
export class GkrBatchProof {
  constructor(
    /** Sum-check proof for each layer. */
    public readonly sumcheckProofs: SumcheckProof[],
    /** Mask for each layer for each instance. */
    public readonly layerMasksByInstance: GkrMask[][],
    /** Column circuit outputs for each instance. */
    public readonly outputClaimsByInstance: SecureField[][]
  ) {}
}

/**
 * Values of interest obtained from the execution of the GKR protocol.
 */
export class GkrArtifact {
  constructor(
    /** Out-of-domain (OOD) point for evaluating columns in the input layer. */
    public readonly oodPoint: SecureField[],
    /** The claimed evaluation at `oodPoint` for each column in the input layer of each instance. */
    public readonly claimsToVerifyByInstance: SecureField[][],
    /** The number of variables that interpolate the input layer of each instance. */
    public readonly nVariablesByInstance: number[]
  ) {}
}

/**
 * Defines how a circuit operates locally on two input rows to produce a single output row.
 * This local 2-to-1 constraint is what gives the whole circuit its "binary tree" structure.
 *
 * Binary tree structured circuits have a highly regular wiring pattern that fit the structure of
 * the circuits defined in [Thaler13] which allow for efficient linear time (linear in size of the
 * circuit) GKR prover implementations.
 *
 * [Thaler13]: https://eprint.iacr.org/2013/351.pdf
 */
export enum Gate {
  LogUp = 'LogUp',
  GrandProduct = 'GrandProduct',
}

/**
 * Mask has an invalid number of columns
 */
export class InvalidNumMaskColumnsError extends Error {
  constructor() {
    super('Mask has an invalid number of columns');
    this.name = 'InvalidNumMaskColumnsError';
  }
}

/**
 * Stores two evaluations of each column in a GKR layer.
 */
export class GkrMask {
  constructor(private readonly _columns: Array<[SecureField, SecureField]>) {}

  static new(columns: Array<[SecureField, SecureField]>): GkrMask {
    return new GkrMask(columns);
  }

  toRows(): [SecureField[], SecureField[]] {
    const row0: SecureField[] = [];
    const row1: SecureField[] = [];
    
    for (const [a, b] of this._columns) {
      row0.push(a);
      row1.push(b);
    }
    
    return [row0, row1];
  }

  columns(): Array<[SecureField, SecureField]> {
    return [...this._columns];
  }

  /**
   * Returns all `p_i(x)` where `p_i` interpolates column `i` of the mask on `{0, 1}`.
   */
  reduceAtPoint(x: SecureField): SecureField[] {
    return this._columns.map(([v0, v1]) => foldMleEvals(x, v0, v1));
  }
}

/**
 * Error encountered during GKR protocol verification.
 */
export enum GkrErrorType {
  /** The proof is malformed. */
  MalformedProof = 'MalformedProof',
  /** Mask has an invalid number of columns. */
  InvalidMask = 'InvalidMask',
  /** There is a mismatch between the number of instances in the proof and the number of instances passed for verification. */
  NumInstancesMismatch = 'NumInstancesMismatch',
  /** There was an error with one of the sumcheck proofs. */
  InvalidSumcheck = 'InvalidSumcheck',
  /** The circuit polynomial the verifier evaluated doesn't match claim from sumcheck. */
  CircuitCheckFailure = 'CircuitCheckFailure',
}

export class GkrError extends Error {
  constructor(
    public readonly type: GkrErrorType,
    public readonly details?: any
  ) {
    super(GkrError.getMessage(type, details));
    this.name = 'GkrError';
  }

  private static getMessage(type: GkrErrorType, details?: any): string {
    switch (type) {
      case GkrErrorType.MalformedProof:
        return 'proof data is invalid';
      case GkrErrorType.InvalidMask:
        return `mask in layer ${details?.instanceLayer} of instance ${details?.instance} is invalid`;
      case GkrErrorType.NumInstancesMismatch:
        return `provided an invalid number of instances (given ${details?.given}, proof expects ${details?.proof})`;
      case GkrErrorType.InvalidSumcheck:
        return `sum-check invalid in layer ${details?.layer}: ${details?.source}`;
      case GkrErrorType.CircuitCheckFailure:
        return `circuit check failed in layer ${details?.layer} (calculated ${details?.output}, claim ${details?.claim})`;
      default:
        return `Unknown GKR error: ${type}`;
    }
  }
}

/**
 * GKR layer index where 0 corresponds to the output layer.
 */
export type LayerIndex = number;