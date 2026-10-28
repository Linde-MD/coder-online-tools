import { describe, expect, it } from 'vitest';
import { validateSignalLayout } from '../../../src/features/can-arch/services/signal-layout.js';

describe('validateSignalLayout', () => {
  const message = { dlc: 8, byteOrder: 'intel' };

  it('accepts a signal ending exactly at the Intel payload boundary', () => {
    expect(validateSignalLayout({ startBit: 56, length: 8 }, message)).toMatchObject({
      totalBits: 64,
      startBitError: '',
      lengthError: '',
      messageError: '',
      bits: [56, 57, 58, 59, 60, 61, 62, 63],
    });
  });

  it('reports the start bit outside the payload', () => {
    expect(validateSignalLayout({ startBit: 66, length: 8 }, message).startBitError).toContain('0-63');
  });

  it('reports combined Intel range overflow', () => {
    expect(validateSignalLayout({ startBit: 60, length: 8 }, message).lengthError).toContain('溢出');
  });

  it('uses the existing Motorola LSB convention across byte boundaries', () => {
    const result = validateSignalLayout({ startBit: 8, length: 16 }, { dlc: 2, byteOrder: 'motorola' });
    expect(result.bits).toEqual([8, 9, 10, 11, 12, 13, 14, 15, 0, 1, 2, 3, 4, 5, 6, 7]);
    expect(result.lengthError).toBe('');
  });

  it('detects Motorola overflow that a linear range check misses', () => {
    expect(validateSignalLayout({ startBit: 7, length: 2 }, { dlc: 2, byteOrder: 'motorola' }).lengthError).toContain('溢出');
  });

  it.each(['', -1, 1.5, NaN, Infinity])('rejects invalid start bit %s', (startBit) => {
    expect(validateSignalLayout({ startBit, length: 8 }, message).startBitError).not.toBe('');
  });

  it.each(['', 0, -1, 1.5, NaN, Infinity])('rejects invalid length %s', (length) => {
    expect(validateSignalLayout({ startBit: 0, length }, message).lengthError).not.toBe('');
  });

  it('rejects oversized lengths without expanding them', () => {
    const result = validateSignalLayout({ startBit: 0, length: Number.MAX_SAFE_INTEGER }, message);
    expect(result.lengthError).not.toBe('');
    expect(result.bits).toEqual([]);
  });

  it('treats DLC zero as an empty payload', () => {
    const result = validateSignalLayout({ startBit: 0, length: 1 }, { dlc: 0 });
    expect(result.totalBits).toBe(0);
    expect(result.startBitError).toContain('没有可用位');
  });

  it('supports 64-byte payloads', () => {
    expect(validateSignalLayout({ startBit: 511, length: 1 }, { dlc: 64 }).lengthError).toBe('');
  });

  it('recomputes the result when the parent DLC changes', () => {
    const parent = { dlc: 8, byteOrder: 'intel' };
    const signal = { startBit: 56, length: 8 };
    expect(validateSignalLayout(signal, parent).startBitError).toBe('');
    parent.dlc = 7;
    expect(validateSignalLayout(signal, parent).startBitError).not.toBe('');
  });

  it.each([undefined, '', -1, 1.5, 65])('reports invalid DLC %s instead of assuming capacity', (dlc) => {
    expect(validateSignalLayout({ startBit: 0, length: 1 }, { dlc }).messageError).not.toBe('');
  });
});