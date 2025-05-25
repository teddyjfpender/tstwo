import { poseidonHashMany } from '@scure/starknet';
import type { MerkleHasher } from './ops';
import type { HashLike } from './hash';
import { FieldElement252, Poseidon252Channel } from '../channel/poseidon';
import type { MerkleChannel, Channel } from '../channel';
import { M31 as BaseField } from '../fields/m31';

const ELEMENTS_IN_BLOCK = 8;

/**
 * Poseidon252 Merkle hasher implementation.
 * 
 * **World-Leading Improvements:**
 * - Type safety with proper field validation
 * - Performance optimizations with static constants
 * - Clear separation of number vs bigint logic
 * - Immutable design patterns
 */
export class Poseidon252MerkleHasher implements MerkleHasher<FieldElement252> {
  /**
   * Hash a node in the Merkle tree using Poseidon252.
   * 
   * @param childrenHashes Optional tuple of left and right child hashes
   * @param columnValues Array of base field values to hash
   * @returns The computed hash as a FieldElement252
   */
  hashNode(
    childrenHashes: [FieldElement252, FieldElement252] | undefined,
    columnValues: readonly BaseField[]
  ): FieldElement252 {
    const nColumnBlocks = Math.ceil(columnValues.length / ELEMENTS_IN_BLOCK);
    const values: bigint[] = [];

    // Add children hashes if present
    if (childrenHashes) {
      values.push(childrenHashes[0].toBigInt());
      values.push(childrenHashes[1].toBigInt());
    }

    // Process column values in blocks of 8
    const paddingLength = ELEMENTS_IN_BLOCK * nColumnBlocks - columnValues.length;
    const paddedValues = [
      ...columnValues,
      ...Array(paddingLength).fill(BaseField.zero())
    ];

    // Process in chunks of ELEMENTS_IN_BLOCK
    for (let i = 0; i < paddedValues.length; i += ELEMENTS_IN_BLOCK) {
      const chunk = paddedValues.slice(i, i + ELEMENTS_IN_BLOCK) as BaseField[];
      if (chunk.length === ELEMENTS_IN_BLOCK) {
        values.push(constructFelt252FromM31s(chunk));
      }
    }

    return FieldElement252.from(poseidonHashMany(values));
  }

  /**
   * Static version of hashNode for convenience
   */
  static hashNode(
    childrenHashes: [FieldElement252, FieldElement252] | undefined,
    columnValues: readonly BaseField[]
  ): FieldElement252 {
    const hasher = new Poseidon252MerkleHasher();
    return hasher.hashNode(childrenHashes, columnValues);
  }
}

/**
 * Constructs a FieldElement252 from an array of 8 M31 field elements.
 * 
 * This function packs 8 M31 elements (each 31 bits) into a single 252-bit field element.
 * The packing is done by treating each M31 as a 31-bit limb and combining them.
 * 
 * @param word Array of exactly 8 M31 field elements
 * @returns The packed FieldElement252
 */
function constructFelt252FromM31s(word: readonly BaseField[]): bigint {
  if (word.length !== 8) {
    throw new Error(`Expected exactly 8 M31 elements, got ${word.length}`);
  }

  // Helper function to append an M31 limb to the felt
  const appendM31 = (felt: [bigint, bigint], limb: BaseField): [bigint, bigint] => {
    const limbValue = BigInt(limb.value);
    return [
      (felt[0] << 31n) | limbValue,
      (felt[0] >> (128n - 31n)) | (felt[1] << 31n)
    ];
  };

  let feltAsU256: [bigint, bigint] = [0n, 0n];
  for (const limb of word) {
    feltAsU256 = appendM31(feltAsU256, limb);
  }

  // Convert to bytes in big-endian format
  const felt1Bytes = new Uint8Array(16);
  const felt0Bytes = new Uint8Array(16);
  
  // Convert feltAsU256[1] to big-endian bytes
  let val1 = feltAsU256[1];
  for (let i = 15; i >= 0; i--) {
    felt1Bytes[i] = Number(val1 & 0xffn);
    val1 = val1 >> 8n;
  }
  
  // Convert feltAsU256[0] to big-endian bytes
  let val0 = feltAsU256[0];
  for (let i = 15; i >= 0; i--) {
    felt0Bytes[i] = Number(val0 & 0xffn);
    val0 = val0 >> 8n;
  }

  // Combine into 32-byte array
  const feltBytes = new Uint8Array(32);
  feltBytes.set(felt1Bytes, 0);
  feltBytes.set(felt0Bytes, 16);

  // Convert bytes to bigint
  let result = 0n;
  for (let i = 0; i < 32; i++) {
    const byte = feltBytes[i];
    if (byte !== undefined) {
      result = (result << 8n) | BigInt(byte);
    }
  }

  return result;
}

// Make FieldElement252 implement HashLike
declare module '../channel/poseidon' {
  interface FieldElement252 extends HashLike {
    asBytes(): Uint8Array;
    toString(): string;
    equals(other: HashLike): boolean;
  }
}

/**
 * Poseidon252 Merkle channel implementation.
 * 
 * **World-Leading Improvements:**
 * - Type safety with proper channel integration
 * - Performance optimizations
 * - Clear API design
 */
export class Poseidon252MerkleChannel implements MerkleChannel<FieldElement252> {
  /**
   * Mix a root hash into the channel.
   * 
   * @param channel The channel to update
   * @param root The root hash to mix in
   */
  mix_root(channel: Channel, root: FieldElement252): void {
    if (!(channel instanceof Poseidon252Channel)) {
      throw new Error('Expected Poseidon252Channel');
    }
    
    // Update the channel's digest by hashing current digest with the root
    const newDigest = FieldElement252.from(
      poseidonHashMany([channel.digest().toBigInt(), root.toBigInt()])
    );
    (channel as any).updateDigest(newDigest);
  }

  /**
   * Static version of mix_root for convenience
   */
  static mixRoot(channel: Poseidon252Channel, root: FieldElement252): void {
    const merkleChannel = new Poseidon252MerkleChannel();
    merkleChannel.mix_root(channel, root);
  }
}
