/**
 * Unit tests for utility functions
 */

import {
  hexToBytes,
  bytesToHex,
  veilToSatoshis,
  satoshisToVeil,
  formatAmount,
  isValidStealthAddress,
  isValidAmount,
  isValidRingSize,
  concatBytes,
  bytesEqual,
} from '../src/utils';

describe('Hex Conversion', () => {
  test('hexToBytes converts correctly', () => {
    const hex = '0123456789abcdef';
    const bytes = hexToBytes(hex);
    expect(bytes).toEqual(new Uint8Array([0x01, 0x23, 0x45, 0x67, 0x89, 0xab, 0xcd, 0xef]));
  });

  test('bytesToHex converts correctly', () => {
    const bytes = new Uint8Array([0x01, 0x23, 0x45, 0x67, 0x89, 0xab, 0xcd, 0xef]);
    const hex = bytesToHex(bytes);
    expect(hex).toBe('0123456789abcdef');
  });

  test('hexToBytes and bytesToHex are inverse operations', () => {
    const original = '0123456789abcdef';
    const roundTrip = bytesToHex(hexToBytes(original));
    expect(roundTrip).toBe(original);
  });

  test('hexToBytes handles 0x prefix', () => {
    const bytes = hexToBytes('0x1234');
    expect(bytes).toEqual(new Uint8Array([0x12, 0x34]));
  });

  test('hexToBytes throws on odd length', () => {
    expect(() => hexToBytes('123')).toThrow('odd length');
  });
});

describe('Amount Conversion', () => {
  test('veilToSatoshis converts correctly', () => {
    expect(veilToSatoshis(1)).toBe(100_000_000n);
    expect(veilToSatoshis(0.5)).toBe(50_000_000n);
    expect(veilToSatoshis(0.00000001)).toBe(1n);
  });

  test('satoshisToVeil converts correctly', () => {
    expect(satoshisToVeil(100_000_000n)).toBe(1);
    expect(satoshisToVeil(50_000_000n)).toBe(0.5);
    expect(satoshisToVeil(1n)).toBe(0.00000001);
  });

  test('formatAmount formats correctly', () => {
    expect(formatAmount(100_000_000n)).toBe('1.00000000 VEIL');
    expect(formatAmount(50_000_000n)).toBe('0.50000000 VEIL');
    expect(formatAmount(1n)).toBe('0.00000001 VEIL');
  });

  test('formatAmount respects decimals parameter', () => {
    expect(formatAmount(100_000_000n, 2)).toBe('1.00 VEIL');
    expect(formatAmount(100_000_000n, 0)).toBe('1 VEIL');
  });
});

describe('Stealth Address Validation', () => {
  test('rejects addresses not starting with sv1', () => {
    expect(isValidStealthAddress('bv1qqqqqqqqqqqqqqqqq')).toBe(false);
    expect(isValidStealthAddress('sv2qqqqqqqqqqqqqqqqq')).toBe(false);
  });

  test('rejects addresses that are too short', () => {
    expect(isValidStealthAddress('sv1qq')).toBe(false);
  });

  test('rejects addresses that are too long', () => {
    const tooLong = 'sv1' + 'q'.repeat(200);
    expect(isValidStealthAddress(tooLong)).toBe(false);
  });

  test('rejects addresses with invalid characters', () => {
    // bech32 doesn't allow 'b', 'i', 'o'
    expect(isValidStealthAddress('sv1qqqbqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq')).toBe(false);
  });

  test('accepts valid-looking addresses', () => {
    // Note: This doesn't validate checksum, just format
    const validFormat = 'sv1' + 'q'.repeat(100);
    expect(isValidStealthAddress(validFormat)).toBe(true);
  });
});

describe('Validation Functions', () => {
  test('isValidAmount accepts valid amounts', () => {
    expect(isValidAmount(1n)).toBe(true);
    expect(isValidAmount(100_000_000n)).toBe(true);
    expect(isValidAmount(1_000_000_000_000_000n)).toBe(true);
  });

  test('isValidAmount rejects invalid amounts', () => {
    expect(isValidAmount(0n)).toBe(false);
    expect(isValidAmount(-1n)).toBe(false);
    expect(isValidAmount(21_000_000n * 100_000_000n + 1n)).toBe(false); // Over max supply
  });

  test('isValidRingSize accepts valid ring sizes', () => {
    expect(isValidRingSize(3)).toBe(true);
    expect(isValidRingSize(11)).toBe(true);
    expect(isValidRingSize(32)).toBe(true);
  });

  test('isValidRingSize rejects invalid ring sizes', () => {
    expect(isValidRingSize(2)).toBe(false);
    expect(isValidRingSize(33)).toBe(false);
    expect(isValidRingSize(0)).toBe(false);
  });
});

describe('Byte Array Utilities', () => {
  test('concatBytes concatenates arrays', () => {
    const a = new Uint8Array([1, 2, 3]);
    const b = new Uint8Array([4, 5, 6]);
    const c = new Uint8Array([7, 8, 9]);
    const result = concatBytes(a, b, c);
    expect(result).toEqual(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9]));
  });

  test('bytesEqual compares arrays correctly', () => {
    const a = new Uint8Array([1, 2, 3]);
    const b = new Uint8Array([1, 2, 3]);
    const c = new Uint8Array([1, 2, 4]);
    expect(bytesEqual(a, b)).toBe(true);
    expect(bytesEqual(a, c)).toBe(false);
  });

  test('bytesEqual returns false for different lengths', () => {
    const a = new Uint8Array([1, 2, 3]);
    const b = new Uint8Array([1, 2]);
    expect(bytesEqual(a, b)).toBe(false);
  });
});
