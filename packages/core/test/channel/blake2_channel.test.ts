import { describe, test, expect } from 'vitest';
import { Blake2sChannel } from '../../src/channel/blake2';
import { QM31 as SecureField } from '../../src/fields/qm31';
import { M31 } from '../../src/fields/m31';

describe('Blake2sChannel', () => {
  test('channel_time', () => {
    const channel = Blake2sChannel.create();

    expect(channel.getChannelTime().n_challenges).toBe(0);
    expect(channel.getChannelTime().n_sent).toBe(0);

    channel.draw_random_bytes();
    expect(channel.getChannelTime().n_challenges).toBe(0);
    expect(channel.getChannelTime().n_sent).toBe(1);

    channel.draw_felts(9);
    expect(channel.getChannelTime().n_challenges).toBe(0);
    expect(channel.getChannelTime().n_sent).toBe(6);
  });

  test('draw_random_bytes returns different values', () => {
    const channel = Blake2sChannel.create();

    const first = channel.draw_random_bytes();
    const second = channel.draw_random_bytes();

    expect(first).not.toEqual(second);
  });

  test('draw_felt returns different values', () => {
    const channel = Blake2sChannel.create();

    const first = channel.draw_felt();
    const second = channel.draw_felt();

    expect(first.equals(second)).toBe(false);
  });

  test('draw_felts returns unique values', () => {
    const channel = Blake2sChannel.create();

    const felts = channel.draw_felts(5);
    felts.push(...channel.draw_felts(4));

    const uniqueFelts = new Set(felts.map(f => f.toString()));
    expect(uniqueFelts.size).toBe(felts.length);
  });

  test('mix_felts changes digest', () => {
    const channel = Blake2sChannel.create();
    const initialDigest = channel.digest();

    const felts = [
      SecureField.from(M31.from(123)),
      SecureField.from(M31.from(456))
    ];
    channel.mix_felts(felts);

    expect(channel.digest().equals(initialDigest)).toBe(false);
  });

  test('mix_u64 equals mix_u32s', () => {
    const channel1 = Blake2sChannel.create();
    const channel2 = Blake2sChannel.create();

    const value = 0x1234567890abcdefn;
    channel1.mix_u64(value);
    channel2.mix_u32s([0x90abcdef, 0x12345678]); // Little-endian split

    expect(channel1.digest().equals(channel2.digest())).toBe(true);
  });
});
