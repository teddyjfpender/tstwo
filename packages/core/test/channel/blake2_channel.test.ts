import { describe, it, expect } from 'vitest';
import { Blake2sChannel } from '../../src/channel/blake2';
import { QM31 as SecureField } from '../../src/fields/qm31';
import { M31 } from '../../src/fields/m31';

describe('Blake2sChannel', () => {
  it('channel_time', () => {
    const ch = new Blake2sChannel();
    expect(ch.channel_time.n_challenges).toBe(0);
    expect(ch.channel_time.n_sent).toBe(0);

    ch.draw_random_bytes();
    expect(ch.channel_time.n_challenges).toBe(0);
    expect(ch.channel_time.n_sent).toBe(1);

    ch.draw_felts(9);
    expect(ch.channel_time.n_challenges).toBe(0);
    expect(ch.channel_time.n_sent).toBe(6);
  });

  it('draw_random_bytes returns different values', () => {
    const ch = new Blake2sChannel();
    const first = ch.draw_random_bytes();
    const second = ch.draw_random_bytes();
    expect(Buffer.from(first).equals(Buffer.from(second))).toBe(false);
  });

  it('draw_felt returns different values', () => {
    const ch = new Blake2sChannel();
    const first = ch.draw_felt();
    const second = ch.draw_felt();
    expect(first.equals(second)).toBe(false);
  });

  it('draw_felts returns unique values', () => {
    const ch = new Blake2sChannel();
    const vals = ch.draw_felts(5).concat(ch.draw_felts(4));
    const set = new Set(vals.map(v => v.toString()));
    expect(set.size).toBe(vals.length);
  });

  it('mix_felts changes digest', () => {
    const ch = new Blake2sChannel();
    const initial = Buffer.from(ch.digestBytes()).toString('hex');
    const felts = [0,1].map(i => SecureField.fromM31Array([
      M31.from(i+1923782), M31.from(i+1923783), M31.from(i+1923784), M31.from(i+1923785)
    ]));
    ch.mix_felts(felts);
    expect(Buffer.from(ch.digestBytes()).toString('hex')).not.toBe(initial);
  });

  it('mix_u64 equals mix_u32s', () => {
    const ch1 = new Blake2sChannel();
    ch1.mix_u64(0x1111222233334444n);
    const digest64 = Buffer.from(ch1.digestBytes()).toString('hex');

    const ch2 = new Blake2sChannel();
    ch2.mix_u32s([0x33334444, 0x11112222]);
    expect(Buffer.from(ch2.digestBytes()).toString('hex')).toBe(digest64);
  });
});
