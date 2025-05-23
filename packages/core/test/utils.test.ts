import { describe, it, expect } from 'vitest';
import {
  bitReverseIndex,
  bitReverseIndexConst,
  previousBitReversedCircleDomainIndex,
  offsetBitReversedCircleDomainIndex,
  circleDomainOrderToCosetOrder,
  cosetOrderToCircleDomainOrder,
  circleDomainIndexToCosetIndex,
  cosetIndexToCircleDomainIndex,
  bitReverseCosetToCircleDomainOrder,
  uninitVec,
  PeekTakeWhile,
  implementPeekableExt,
  implementIteratorMutExt
} from '../src/utils';

describe('utils', () => {
  describe('bitReverseIndex', () => {
    it('should correctly reverse bits', () => {
      expect(bitReverseIndex(0, 3)).toBe(0);
      expect(bitReverseIndex(1, 3)).toBe(4);
      expect(bitReverseIndex(2, 3)).toBe(2);
      expect(bitReverseIndex(3, 3)).toBe(6);
      expect(bitReverseIndex(4, 3)).toBe(1);
      expect(bitReverseIndex(5, 3)).toBe(5);
      expect(bitReverseIndex(6, 3)).toBe(3);
      expect(bitReverseIndex(7, 3)).toBe(7);
    });

    it('should handle zero log size', () => {
      expect(bitReverseIndexConst(5, 0)).toBe(5);
    });
  });

  describe('circle domain index conversions', () => {
    it('should convert between circle domain and coset indices', () => {
      const logSize = 3;
      const n = 1 << logSize;

      for (let i = 0; i < n; i++) {
        const cosetIdx = circleDomainIndexToCosetIndex(i, logSize);
        const circleIdx = cosetIndexToCircleDomainIndex(cosetIdx, logSize);
        expect(circleIdx).toBe(i);
      }
    });
  });

  describe('bit reversed circle domain index', () => {
    it('should calculate previous index correctly', () => {
      const domainLogSize = 3;
      const evalLogSize = 6;
      const initialIndex = 5;

      const actual = offsetBitReversedCircleDomainIndex(
        initialIndex,
        domainLogSize,
        evalLogSize,
        -2
      );
      const expectedPrev = previousBitReversedCircleDomainIndex(
        initialIndex,
        domainLogSize,
        evalLogSize
      );
      const expectedPrev2 = previousBitReversedCircleDomainIndex(
        expectedPrev,
        domainLogSize,
        evalLogSize
      );
      expect(actual).toBe(expectedPrev2);
    });
  });

  describe('order conversions', () => {
    it('should convert between circle domain and coset orders', () => {
      const values = [0, 1, 2, 3, 4, 5, 6, 7];
      const cosetOrder = circleDomainOrderToCosetOrder(values);
      const circleDomainOrder = cosetOrderToCircleDomainOrder(cosetOrder);
      expect(circleDomainOrder).toEqual(values);
    });
  });

  describe('bit reverse coset to circle domain order', () => {
    it('should perform in-place permutation', () => {
      const arr = [0, 1, 2, 3, 4, 5, 6, 7];
      bitReverseCosetToCircleDomainOrder(arr);
      console.log('bitReverseCosetToCircleDomainOrder result:', arr);
      expect(arr).toEqual([0, 7, 4, 3, 2, 5, 6, 1]);
    });

    it('should throw error for non-power-of-two length', () => {
      const arr = [0, 1, 2, 3, 4];
      expect(() => bitReverseCosetToCircleDomainOrder(arr)).toThrow('Length must be a power of two');
    });
  });

  describe('PeekTakeWhile', () => {
    it('should take elements while predicate is true', () => {
      const arr = [1, 2, 3, 4, 5];
      const iterator = arr[Symbol.iterator]();
      const peekable = implementPeekableExt<number, Iterator<number>>(iterator);
      const takeWhile = peekable.peekTakeWhile((x: number) => x < 4);
      
      const result: number[] = [];
      let next = takeWhile.next();
      while (!next.done) {
        result.push(next.value);
        next = takeWhile.next();
      }
      expect(result).toEqual([1, 2, 3]);
    });
  });

  describe('IteratorMutExt', () => {
    it('should assign values from other iterable', () => {
      const arr = [{ value: 1 }, { value: 2 }, { value: 3 }];
      const iterator = arr[Symbol.iterator]();
      const mutExt = implementIteratorMutExt(iterator);
      
      mutExt.assign([{ value: 4 }, { value: 5 }, { value: 6 }]);
      expect(arr).toEqual([{ value: 4 }, { value: 5 }, { value: 6 }]);
    });
  });

  describe('uninitVec', () => {
    it('should create array of specified length', () => {
      const len = 5;
      const vec = uninitVec<number>(len);
      expect(vec.length).toBe(len);
    });
  });
}); 