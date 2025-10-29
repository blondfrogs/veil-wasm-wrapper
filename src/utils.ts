/**
 * Utility functions for transaction building
 */

import { Hash, PublicKey, InvalidAddressError } from './types';

// ============================================================================
// Hex Conversion
// ============================================================================

/**
 * Convert hex string to Uint8Array
 */
export function hexToBytes(hex: string): Uint8Array {
  // Remove 0x prefix if present
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;

  if (cleanHex.length % 2 !== 0) {
    throw new Error('Invalid hex string: odd length');
  }

  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(cleanHex.substr(i * 2, 2), 16);
  }
  return bytes;
}

/**
 * Convert Uint8Array to hex string
 */
export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// ============================================================================
// Stealth Address Utilities
// ============================================================================

/**
 * Validate a Veil stealth address
 * Format: sv1 + bech32 encoded data
 */
export function isValidStealthAddress(address: string): boolean {
  // Veil stealth addresses start with 'sv1'
  if (!address.startsWith('sv1')) {
    return false;
  }

  // Basic length check (stealth addresses are typically 95-122 chars)
  if (address.length < 95 || address.length > 122) {
    return false;
  }

  // Check valid bech32 characters (alphanumeric lowercase, no 'b', 'i', 'o')
  const validChars = /^sv1[ac-hj-np-z02-9]+$/;
  return validChars.test(address);
}

/**
 * Decode a stealth address to its components
 * Returns: { scanPubkey, spendPubkey }
 */
export function decodeStealthAddress(address: string): {
  scanPubkey: PublicKey;
  spendPubkey: PublicKey;
} {
  if (!isValidStealthAddress(address)) {
    throw new InvalidAddressError(address);
  }

  // TODO: Implement proper bech32 decoding
  // For now, this is a placeholder
  // Real implementation needs to decode the bech32 format and extract:
  // - Scan public key (33 bytes)
  // - Spend public key (33 bytes)

  throw new Error('Stealth address decoding not yet implemented');
}

/**
 * Encode a stealth address from scan and spend pubkeys
 */
export function encodeStealthAddress(
  scanPubkey: PublicKey,
  spendPubkey: PublicKey
): string {
  // TODO: Implement proper bech32 encoding
  // Format: sv1 + bech32(scanPubkey + spendPubkey)

  throw new Error('Stealth address encoding not yet implemented');
}

// ============================================================================
// Amount Utilities
// ============================================================================

/**
 * Convert VEIL to satoshis (1 VEIL = 100,000,000 satoshis)
 */
export function veilToSatoshis(veil: number): bigint {
  const SATOSHIS_PER_VEIL = 100_000_000n;
  return BigInt(Math.floor(veil * Number(SATOSHIS_PER_VEIL)));
}

/**
 * Convert satoshis to VEIL
 */
export function satoshisToVeil(satoshis: bigint): number {
  const SATOSHIS_PER_VEIL = 100_000_000n;
  return Number(satoshis) / Number(SATOSHIS_PER_VEIL);
}

/**
 * Format amount for display
 */
export function formatAmount(satoshis: bigint, decimals: number = 8): string {
  const veil = satoshisToVeil(satoshis);
  return veil.toFixed(decimals) + ' VEIL';
}

// ============================================================================
// Array Utilities
// ============================================================================

/**
 * Shuffle array (Fisher-Yates)
 * Used for randomizing decoy selection
 */
export function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Get random elements from array without replacement
 */
export function randomSample<T>(array: T[], count: number): T[] {
  if (count > array.length) {
    throw new Error(`Cannot sample ${count} elements from array of length ${array.length}`);
  }

  const shuffled = shuffleArray(array);
  return shuffled.slice(0, count);
}

// ============================================================================
// Byte Array Utilities
// ============================================================================

/**
 * Concatenate multiple Uint8Arrays
 */
export function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Uint8Array(totalLength);

  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }

  return result;
}

/**
 * Compare two Uint8Arrays for equality
 */
export function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false;
  }

  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }

  return true;
}

/**
 * Generate random bytes (secure)
 */
export function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);

  // Use crypto.getRandomValues if available (browser/node)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    // Fallback to Node's crypto module
    const nodeCrypto = require('crypto');
    const buffer = nodeCrypto.randomBytes(length);
    bytes.set(new Uint8Array(buffer));
  }

  return bytes;
}

// ============================================================================
// Validation Utilities
// ============================================================================

/**
 * Validate that value is within valid range for amounts
 */
export function isValidAmount(amount: bigint): boolean {
  const MAX_AMOUNT = 21_000_000n * 100_000_000n; // 21M VEIL max supply
  return amount > 0n && amount <= MAX_AMOUNT;
}

/**
 * Validate ring size
 */
export function isValidRingSize(ringSize: number): boolean {
  return ringSize >= 3 && ringSize <= 32;
}

/**
 * Validate public key length
 */
export function isValidPublicKey(pubkey: Uint8Array): boolean {
  return pubkey.length === 33 && (pubkey[0] === 0x02 || pubkey[0] === 0x03);
}

/**
 * Validate secret key length
 */
export function isValidSecretKey(seckey: Uint8Array): boolean {
  return seckey.length === 32;
}

/**
 * Validate commitment length
 */
export function isValidCommitment(commitment: Uint8Array): boolean {
  // Pedersen commitments: 0x08 or 0x09 prefix + 32 bytes
  return commitment.length === 33 &&
         (commitment[0] === 0x08 || commitment[0] === 0x09);
}

// ============================================================================
// Debug Utilities
// ============================================================================

/**
 * Format bytes for debug logging
 */
export function debugBytes(label: string, bytes: Uint8Array, maxLen: number = 16): string {
  const hex = bytesToHex(bytes);
  const preview = hex.length > maxLen * 2
    ? hex.slice(0, maxLen * 2) + '...'
    : hex;
  return `${label}: ${preview} (${bytes.length} bytes)`;
}

/**
 * Sleep for testing/debugging
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
