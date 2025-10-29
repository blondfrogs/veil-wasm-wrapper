/**
 * Cryptographic primitives for Veil transaction building
 *
 * This module provides secp256k1 operations needed for:
 * - Public key derivation
 * - Point arithmetic (scalar multiplication, addition)
 * - Hashing operations
 */

import { PublicKey, SecretKey, Hash } from './types';
import { bytesToHex, hexToBytes } from './utils';

// Use the WASM module for crypto operations where possible
import {
  performEcdh,
  getWasm,
  derivePublicKey as wasmDerivePubkey,
  pointAddScalar as wasmPointAddScalar,
  pointMultiply as wasmPointMultiply,
  privateAdd as wasmPrivateAdd
} from './wasm';

// ============================================================================
// Secp256k1 Operations (Pure JS fallback)
// ============================================================================

/**
 * secp256k1 curve order
 */
const CURVE_ORDER = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');

/**
 * Derive a public key from a private key
 * Uses WASM
 */
export function derivePublicKey(privateKey: SecretKey): PublicKey {
  return wasmDerivePubkey(privateKey);
}

/**
 * Add a scalar to a public key point
 * Result = pubkey + (scalar * G)
 */
export function pointAddScalar(pubkey: PublicKey, scalar: Uint8Array): PublicKey {
  return wasmPointAddScalar(pubkey, scalar);
}

/**
 * Multiply a public key point by a scalar
 * Result = scalar * pubkey
 */
export function pointMultiply(pubkey: PublicKey, scalar: SecretKey): PublicKey {
  return wasmPointMultiply(pubkey, scalar);
}

/**
 * Add two private keys (mod curve order)
 * Result = (a + b) mod n
 */
export function privateAdd(a: SecretKey, b: SecretKey): SecretKey {
  return wasmPrivateAdd(a, b);
}

/**
 * Subtract two private keys (mod curve order)
 * Result = (a - b) mod n
 */
export function privateSub(a: SecretKey, b: SecretKey): SecretKey {
  const aBig = BigInt('0x' + bytesToHex(a));
  const bBig = BigInt('0x' + bytesToHex(b));
  const diff = (aBig - bBig + CURVE_ORDER) % CURVE_ORDER;

  const hex = diff.toString(16).padStart(64, '0');
  return hexToBytes(hex);
}

// ============================================================================
// Hash Functions
// ============================================================================

/**
 * SHA256 hash
 */
export async function sha256(data: Uint8Array): Promise<Hash> {
  // Use Web Crypto API if available
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data as BufferSource);
    return new Uint8Array(hashBuffer);
  }

  // Fallback to Node.js crypto
  const nodeCrypto = require('crypto');
  const hash = nodeCrypto.createHash('sha256');
  hash.update(data);
  return new Uint8Array(hash.digest());
}

/**
 * Double SHA256 (for TXID calculation)
 */
export async function doubleSha256(data: Uint8Array): Promise<Hash> {
  const hash1 = await sha256(data);
  return sha256(hash1);
}

/**
 * RIPEMD160 hash
 */
export function ripemd160(data: Uint8Array): Hash {
  // Use Node.js crypto
  const nodeCrypto = require('crypto');
  const hash = nodeCrypto.createHash('ripemd160');
  hash.update(data);
  return new Uint8Array(hash.digest());
}

/**
 * Hash160 (SHA256 then RIPEMD160)
 * Used for spend secret ID in stealth addresses
 */
export async function hash160(data: Uint8Array): Promise<Hash> {
  const sha = await sha256(data);
  return ripemd160(sha);
}

// ============================================================================
// Random Number Generation
// ============================================================================

/**
 * Generate cryptographically secure random bytes
 */
export function getRandomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);

  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    const nodeCrypto = require('crypto');
    const buffer = nodeCrypto.randomBytes(length);
    bytes.set(new Uint8Array(buffer));
  }

  return bytes;
}

/**
 * Generate a random private key
 */
export function generatePrivateKey(): SecretKey {
  // Keep generating until we get a valid key (< curve order)
  while (true) {
    const key = getRandomBytes(32);
    const keyBig = BigInt('0x' + bytesToHex(key));

    if (keyBig > 0n && keyBig < CURVE_ORDER) {
      return key;
    }
  }
}
