/**
 * Range Proof Parameter Selection
 *
 * Ports Veil Core's SelectRangeProofParameters algorithm from blind.cpp
 * to TypeScript for optimal and privacy-preserving range proof generation.
 *
 * Reference: /Users/jeremy/veil/src/veil/ringct/blind.cpp:59-109
 */

export interface RangeProofParams {
  minValue: bigint;
  exponent: number;
  minBits: number;
}

/**
 * Count leading zeros in a 64-bit value
 *
 * This counts zeros from the LSB (least significant bit) upward.
 * Matches Veil Core's CountLeadingZeros behavior.
 */
function countLeadingZeros(value: bigint): number {
  let zeros = 0;
  let n = value;

  for (let i = 0; i < 64; i++, n >>= 1n) {
    if ((n & 1n) !== 0n) {
      break;
    }
    zeros++;
  }

  return zeros;
}

/**
 * Count trailing zeros in a 64-bit value
 *
 * This counts zeros from the MSB (most significant bit) downward.
 * Matches Veil Core's CountTrailingZeros behavior.
 */
function countTrailingZeros(value: bigint): number {
  let zeros = 0;
  let n = value;
  const mask = 1n << 63n;

  for (let i = 0; i < 64; i++, n <<= 1n) {
    if ((n & mask) !== 0n) {
      break;
    }
    zeros++;
  }

  return zeros;
}

/**
 * Integer power function
 *
 * Calculates base^exp using repeated multiplication.
 */
function ipow(base: bigint, exp: number): bigint {
  let result = 1n;
  let b = base;
  let e = exp;

  while (e > 0) {
    if (e & 1) {
      result *= b;
    }
    e >>= 1;
    b *= b;
  }

  return result;
}

/**
 * Get random integer in range [0, max)
 *
 * Uses cryptographically secure randomness.
 */
function getRandomInt(max: number): number {
  if (max <= 0) return 0;

  // Use crypto.getRandomValues for secure randomness
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);

  return array[0] % max;
}

/**
 * Select optimal range proof parameters for a value
 *
 * This algorithm analyzes the value to determine:
 * - exponent: Base-10 exponent to reduce proof size
 * - minBits: Minimum bits needed to represent the value
 * - minValue: Minimum value in the proven range (usually 0)
 *
 * The algorithm provides privacy through:
 * - Randomized exponent selection within valid range
 * - Randomized bit padding for zero values
 * - Variable proof sizes that don't directly correlate to value
 *
 * Matches Veil Core's behavior:
 * /Users/jeremy/veil/src/veil/ringct/blind.cpp:59-109
 *
 * @param value - The value to prove (in satoshis)
 * @returns Range proof parameters
 */
export function selectRangeProofParameters(value: bigint): RangeProofParams {
  // Special case: zero value
  if (value === 0n) {
    // Randomize parameters for privacy
    const exponent = getRandomInt(5);
    let minBits = 32;

    // 10% chance to increase bits for additional obfuscation
    if (getRandomInt(10) === 0) {
      minBits += getRandomInt(5);
    }

    return {
      minValue: 0n,
      exponent,
      minBits,
    };
  }

  // Count leading and trailing zeros
  const nLeadingZeros = countLeadingZeros(value);
  const nTrailingZeros = countTrailingZeros(value);

  // Initial bits requirement
  let nBitsReq = 64 - nLeadingZeros - nTrailingZeros;
  let minBits = 32;

  // Count how many times the value is divisible by 10
  // This determines the maximum exponent we can use
  let nTest = value;
  let nDiv10 = 0; // max exponent

  while (nTest % 10n === 0n) {
    nDiv10++;
    nTest /= 10n;
  }

  // Pick a random exponent between min and max
  // This provides privacy by varying the proof structure
  const eMin = Math.floor(nDiv10 / 2);
  const exponent = eMin + getRandomInt(Math.max(1, nDiv10 - eMin));

  // Divide the value by 10^exponent
  nTest = value / ipow(10n, exponent);

  // Recalculate bits needed for the reduced value
  const nTrailingZerosReduced = countTrailingZeros(nTest);
  nBitsReq = 64 - nTrailingZerosReduced;

  // Use higher bit count if needed
  if (nBitsReq > 32) {
    minBits = nBitsReq;
  }

  // Make minBits a multiple of 4 for efficiency
  // Borromean ring signatures work best with radix-4
  while (minBits < 63 && minBits % 4 !== 0) {
    minBits++;
  }

  return {
    minValue: 0n,
    exponent,
    minBits,
  };
}

/**
 * Get standard Veil range proof parameters
 *
 * These are the most common parameters used in Veil transactions.
 * Use this for consistency when you don't need optimization.
 *
 * @returns Standard Veil parameters (exp=2, minBits=32)
 */
export function getStandardRangeProofParams(): RangeProofParams {
  return {
    minValue: 0n,
    exponent: 2,
    minBits: 32,
  };
}

/**
 * Validate range proof parameters
 *
 * Ensures parameters are within valid ranges.
 *
 * @param params - Parameters to validate
 * @returns true if valid, false otherwise
 */
export function validateRangeProofParams(params: RangeProofParams): boolean {
  // Check exponent range
  if (params.exponent < 0 || params.exponent > 18) {
    return false;
  }

  // Check minBits range
  if (params.minBits < 0 || params.minBits > 64) {
    return false;
  }

  // Check minValue is non-negative
  if (params.minValue < 0n) {
    return false;
  }

  // minBits should be multiple of 4 (except edge cases)
  if (params.minBits > 0 && params.minBits < 63 && params.minBits % 4 !== 0) {
    console.warn('[validateRangeProofParams] minBits is not a multiple of 4, may be suboptimal');
  }

  return true;
}

/**
 * Estimate range proof size
 *
 * Provides an estimate of the proof size in bytes based on parameters.
 * This is approximate and varies based on the actual value.
 *
 * @param params - Range proof parameters
 * @returns Estimated proof size in bytes
 */
export function estimateProofSize(params: RangeProofParams): number {
  // Base proof overhead
  let size = 100;

  // Estimate based on bits
  // Each ring in the Borromean signature adds ~64 bytes
  const rings = Math.ceil(params.minBits / 2);
  size += rings * 64;

  // Exponent adds some overhead
  if (params.exponent > 0) {
    size += 10;
  }

  return size;
}

/**
 * Analyze value characteristics for debugging
 *
 * Provides insights into how a value will be represented in a range proof.
 *
 * @param value - The value to analyze
 * @returns Analysis information
 */
export function analyzeValue(value: bigint): {
  value: bigint;
  divisibleBy10: number;
  leadingZeros: number;
  trailingZeros: number;
  bitsRequired: number;
  suggestedParams: RangeProofParams;
} {
  let nTest = value;
  let div10 = 0;

  while (nTest > 0n && nTest % 10n === 0n) {
    div10++;
    nTest /= 10n;
  }

  const leading = countLeadingZeros(value);
  const trailing = countTrailingZeros(value);
  const bitsReq = 64 - leading - trailing;

  return {
    value,
    divisibleBy10: div10,
    leadingZeros: leading,
    trailingZeros: trailing,
    bitsRequired: bitsReq,
    suggestedParams: selectRangeProofParameters(value),
  };
}
