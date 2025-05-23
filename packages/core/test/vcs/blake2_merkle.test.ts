import { describe, it, expect } from 'vitest';
import { Blake2sMerkleHasher, Blake2sMerkleChannel } from '../../src/vcs/blake2_merkle';
import { Blake2sHash } from '../../src/vcs/blake2_hash';
import { prepareMerkle } from '../../src/vcs/test_utils';
import { M31 as BaseField } from '../../src/fields/m31';
import { Blake2sChannel } from '../../src/channel/blake2';
import { MerkleVerificationError } from '../../src/vcs/verifier';

const hasher = new Blake2sMerkleHasher();

describe('Blake2sMerkle', () => {
  it('test_merkle_success', () => {
    const { queries, decommitment, values, verifier } = prepareMerkle<Blake2sHash>(hasher);
    // The verify method in the provided verifier.ts throws an error on failure, or returns void on success.
    expect(() => verifier.verify(queries, values, decommitment)).not.toThrow();
  });

  it('test_merkle_invalid_witness', () => {
    const { queries, decommitment, values, verifier } = prepareMerkle<Blake2sHash>(hasher);
    // Ensure there are at least 5 elements to modify index 4.
    // prepareMerkle usually creates enough, but good to be defensive if its internals change.
    if (decommitment.hashWitness.length <= 4) {
        // Add dummy hashes if the witness is too short for this test's assumption.
        for(let i = decommitment.hashWitness.length; i <=4; i++) {
            decommitment.hashWitness.push(new Blake2sHash());
        }
    }
    decommitment.hashWitness[4] = new Blake2sHash(); // Default (zero) hash
    expect(() => verifier.verify(queries, values, decommitment)).toThrowError(MerkleVerificationError.RootMismatch);
  });

  it('test_merkle_invalid_value', () => {
    const { queries, decommitment, values, verifier } = prepareMerkle<Blake2sHash>(hasher);
     // Ensure there are at least 7 elements to modify index 6.
    if (values.length <= 6) {
        for(let i = values.length; i <=6; i++) {
            values.push(BaseField.from(i+1)); // Add distinct non-zero dummy values
        }
    }
    values[6] = BaseField.from(0); // BaseField.zero()
    expect(() => verifier.verify(queries, values, decommitment)).toThrowError(MerkleVerificationError.RootMismatch);
  });

  it('test_merkle_witness_too_short', () => {
    const { queries, decommitment, values, verifier } = prepareMerkle<Blake2sHash>(hasher);
    if (decommitment.hashWitness.length > 0) {
      decommitment.hashWitness.pop();
    } else {
      // If hashWitness is already empty, verifier.verify should ideally catch this.
      // This test specifically checks the case where it becomes too short *after* decommit.
      // If prepareMerkle can return empty witness, this test might need adjustment
      // or the scenario is already covered by RootMismatch if an empty witness is always invalid.
      // For now, assume prepareMerkle returns non-empty witness.
    }
    expect(() => verifier.verify(queries, values, decommitment)).toThrowError(MerkleVerificationError.WitnessTooShort);
  });

  it('test_merkle_witness_too_long', () => {
    const { queries, decommitment, values, verifier } = prepareMerkle<Blake2sHash>(hasher);
    decommitment.hashWitness.push(new Blake2sHash());
    expect(() => verifier.verify(queries, values, decommitment)).toThrowError(MerkleVerificationError.WitnessTooLong);
  });

  it('test_merkle_column_values_too_long', () => {
    const { queries, decommitment, values, verifier } = prepareMerkle<Blake2sHash>(hasher);
    // Ensure values has at least 3 elements to splice correctly
    if (values.length < 3) {
        for(let i = values.length; i < 3; i++) {
            values.push(BaseField.from(i+1));
        }
    }
    values.splice(3, 0, BaseField.from(0)); // Insert value
    expect(() => verifier.verify(queries, values, decommitment)).toThrowError(MerkleVerificationError.TooManyQueriedValues);
  });

  it('test_merkle_column_values_too_short', () => {
    const { queries, decommitment, values, verifier } = prepareMerkle<Blake2sHash>(hasher);
    if (values.length > 3) {
      values.splice(3, 1); // Remove value
    } else if (values.length > 0) {
      values.pop(); // Remove last if not enough elements to splice at 3
    } else {
      // If values is empty, this error might not be the first one hit.
      // This test targets "TooFewQueriedValues".
      // An empty `values` array when queries expect values should trigger this.
    }
    expect(() => verifier.verify(queries, values, decommitment)).toThrowError(MerkleVerificationError.TooFewQueriedValues);
  });

  it('test_merkle_channel', () => {
    // Assuming Blake2sChannel has a parameterless constructor or a static default() method
    // Based on typical patterns, a new instance should be like a default state.
    const channel = new Blake2sChannel(); // Or Blake2sChannel.default() if that's the API
    const { verifier } = prepareMerkle<Blake2sHash>(hasher);
    const blake2sMerkleChannel = new Blake2sMerkleChannel();
    blake2sMerkleChannel.mix_root(channel, verifier.root);

    // Accessing channel.channelTime.nChallenges:
    // This depends on the visibility of channelTime and nChallenges.
    // If channelTime is private, this test needs adjustment (e.g., a getter or different assertion).
    // Let's assume it's accessible for now as per the prompt's example.
    // If not, this might be `(channel as any).channel_time.n_challenges` or require a helper.
    // From channel/blake2.ts, `this.channel_time` is public, and from channel/index.ts, ChannelTime.n_challenges is the property.
    expect(channel.channel_time.n_challenges).toBe(1);
  });
});
