/**
 * WASM module interface
 *
 * This module loads and provides typed wrappers around the @blondfrogs/secp256k1-wasm functions
 */

import { Blind, Commitment, KeyImage, PublicKey, SecretKey } from './types';
import { debug } from './debug';

// ============================================================================
// WASM Module Type Definitions
// ============================================================================

/**
 * WASM module interface (what we expect from @blondfrogs/secp256k1-wasm)
 */
export interface VeilWasm {
  // Initialization
  init_panic_hook(): void;

  // Key Images
  getKeyImage(pk: Uint8Array, sk: Uint8Array): Uint8Array;

  // ECDH
  ecdhVeil(pubkey: Uint8Array, privkey: Uint8Array): Uint8Array;

  // Pedersen Commitments
  pedersenCommit(value: bigint, blind: Uint8Array): Uint8Array;
  pedersenBlindSum(blindsJson: string, nPositive: number): Uint8Array;

  // Range Proofs
  rangeproofSign(
    commitment: Uint8Array,
    value: bigint,
    blind: Uint8Array,
    nonce: Uint8Array,
    message: Uint8Array,
    minValue: bigint,
    exp: number,
    minBits: number
  ): string; // Returns JSON

  rangeproofVerify(
    commitment: Uint8Array,
    proof: Uint8Array
  ): string; // Returns JSON

  rangeproofRewind(
    nonce: Uint8Array,
    commitment: Uint8Array,
    proof: Uint8Array
  ): string; // Returns JSON

  // MLSAG
  prepareMlsag(
    mHex: string,
    nOuts: number,
    nBlinded: number,
    vpInCommitsLen: number,
    vpBlindsLen: number,
    nCols: number,
    nRows: number,
    pcmInJson: string,
    pcmOutJson: string,
    blindsJson: string
  ): string; // Returns JSON

  generateMlsag(
    nonceHex: string,
    preimageHex: string,
    nCols: number,
    nRows: number,
    index: number,
    skJson: string,
    pkHex: string
  ): string; // Returns JSON

  verifyMlsag(
    preimageHex: string,
    nCols: number,
    nRows: number,
    pkHex: string,
    kiHex: string,
    pcHex: string,
    psHex: string
  ): string; // Returns JSON

  // Utilities
  hashSha256(data: Uint8Array): Uint8Array;
  hashKeccak256(data: Uint8Array): Uint8Array;

  // Elliptic Curve Operations
  derivePubkey(secret: Uint8Array): Uint8Array;
  pointAddScalar(pubkey: Uint8Array, scalar: Uint8Array): Uint8Array;
  pointMultiply(pubkey: Uint8Array, scalar: Uint8Array): Uint8Array;
  privateAdd(a: Uint8Array, b: Uint8Array): Uint8Array;
}

// ============================================================================
// WASM Module Loading
// ============================================================================

let wasmModule: VeilWasm | null = null;

/**
 * Initialize the WASM module
 * Must be called before using any crypto functions
 */
export async function initWasm(wasmPath?: string): Promise<VeilWasm> {
  if (wasmModule) {
    return wasmModule;
  }

  try {
    // In Node.js
    if (typeof window === 'undefined') {
      // Try to load from node_modules or provided path
      const modulePath = wasmPath || '@blondfrogs/secp256k1-wasm';
      const module = await import(modulePath);
      // For Node.js wasm-pack build, module is already initialized
      wasmModule = module as VeilWasm;
    }
    // In Browser
    else {
      // Load from provided path or default
      const scriptPath = wasmPath || './veil_wasm.js';
      const module = await import(scriptPath);
      // For browser builds, we may need to call default()
      if (module.default && typeof module.default === 'function') {
        await module.default();
      }
      wasmModule = module as VeilWasm;
    }

    // Initialize panic hook for better error messages
    wasmModule!.init_panic_hook();

    return wasmModule!;
  } catch (error) {
    throw new Error(`Failed to initialize WASM module: ${error}`);
  }
}

/**
 * Get the initialized WASM module
 * Throws if not initialized
 */
export function getWasm(): VeilWasm {
  if (!wasmModule) {
    throw new Error('WASM module not initialized. Call initWasm() first.');
  }
  return wasmModule;
}

// ============================================================================
// Typed Wrapper Functions
// ============================================================================

/**
 * Generate a key image from public key and secret key
 *
 * ⚠️ **Advanced Cryptography** - Used internally by `TransactionBuilder`.
 *
 * Key images prevent double-spending in RingCT transactions.
 * Each UTXO has a unique key image that gets published when spent.
 *
 * @param pk - Public key (33 bytes)
 * @param sk - Secret key (32 bytes)
 * @returns Key image (33 bytes)
 */
export function generateKeyImage(pk: PublicKey, sk: SecretKey): KeyImage {
  const wasm = getWasm();
  return wasm.getKeyImage(pk, sk);
}

/**
 * Perform ECDH (Elliptic Curve Diffie-Hellman) to generate shared secret
 *
 * ⚠️ **Advanced Cryptography** - Used internally for stealth addresses.
 *
 * @param pubkey - Public key (33 bytes)
 * @param privkey - Private key (32 bytes)
 * @returns Shared secret (32 bytes)
 */
export function performEcdh(pubkey: PublicKey, privkey: SecretKey): Uint8Array {
  const wasm = getWasm();
  return wasm.ecdhVeil(pubkey, privkey);
}

/**
 * Create a Pedersen commitment
 *
 * ⚠️ **Advanced Cryptography** - Used internally by `TransactionBuilder`.
 *
 * Pedersen commitments hide transaction amounts while allowing verification.
 * Commitments: C = value*G + blind*H
 *
 * @param value - Amount in satoshis
 * @param blind - 32-byte blinding factor (random)
 * @returns Commitment (33 bytes compressed point)
 *
 * @example
 * ```typescript
 * const value = 100000000n; // 1 VEIL
 * const blind = crypto.getRandomValues(new Uint8Array(32));
 * const commitment = createCommitment(value, blind);
 * ```
 */
export function createCommitment(value: bigint, blind: Blind): Commitment {
  const wasm = getWasm();
  return wasm.pedersenCommit(value, blind);
}

/**
 * Sum blinding factors for Pedersen commitment balance
 *
 * ⚠️ **Advanced Cryptography** - Used internally by `TransactionBuilder`.
 *
 * Calculates: sum(positive_blinds) - sum(negative_blinds)
 * Used to balance commitments in transactions.
 *
 * @param blinds - Array of blinding factors
 * @param nPositive - Number of positive blinds (rest are negative)
 * @returns Summed blind (32 bytes)
 */
export function sumBlinds(blinds: Blind[], nPositive: number): Blind {
  const wasm = getWasm();

  // Convert blinds to hex array
  const hexArray = blinds.map(b => {
    return Array.from(b)
      .map(byte => byte.toString(16).padStart(2, '0'))
      .join('');
  });

  const blindsJson = JSON.stringify(hexArray);
  return wasm.pedersenBlindSum(blindsJson, nPositive);
}

/**
 * Generate a range proof (bulletproof)
 *
 * ⚠️ **Advanced Cryptography** - Used internally by `TransactionBuilder`.
 *
 * Range proofs prove that a committed value is within a valid range (0 to 2^64-1)
 * without revealing the actual value. This prevents negative amounts and overflows.
 *
 * @param params - Range proof parameters
 * @param params.commitment - Pedersen commitment to the value
 * @param params.value - Actual value (must match commitment)
 * @param params.blind - Blinding factor used in commitment
 * @param params.nonce - Random nonce for rewinding
 * @param params.message - Optional message to embed
 * @param params.minValue - Minimum value (default: 0)
 * @param params.exp - Exponent for range (default: -1)
 * @param params.minBits - Minimum bits (default: 0)
 * @returns Range proof and associated data
 */
export function generateRangeProof(params: {
  commitment: Commitment;
  value: bigint;
  blind: Blind;
  nonce: Uint8Array;
  message?: Uint8Array;
  minValue?: bigint;
  exp?: number;
  minBits?: number;
}): {
  proof: Uint8Array;
  commitment: Commitment;
  blind: Blind;
  nonce: Uint8Array;
} {
  const wasm = getWasm();

  const resultJson = wasm.rangeproofSign(
    params.commitment,
    params.value,
    params.blind,
    params.nonce,
    params.message || new Uint8Array(0),
    params.minValue || 0n,
    params.exp ?? -1,
    params.minBits ?? 0
  );

  const result = JSON.parse(resultJson);

  return {
    proof: hexToBytes(result.proof),
    commitment: hexToBytes(result.commitment),
    blind: hexToBytes(result.blind),
    nonce: hexToBytes(result.nonce),
  };
}

/**
 * Verify a range proof
 *
 * ⚠️ **Advanced Cryptography** - Used for transaction validation.
 *
 * Verifies that a range proof is valid and extracts the proven range.
 *
 * @param commitment - Pedersen commitment
 * @param proof - Range proof to verify
 * @returns Proven value range (min and max)
 */
export function verifyRangeProof(
  commitment: Commitment,
  proof: Uint8Array
): { minValue: bigint; maxValue: bigint } {
  const wasm = getWasm();

  const resultJson = wasm.rangeproofVerify(commitment, proof);
  const result = JSON.parse(resultJson);

  return {
    minValue: BigInt(result.minValue),
    maxValue: BigInt(result.maxValue),
  };
}

/**
 * Rewind a range proof to extract the hidden value
 *
 * ✅ **Recommended** - Use this to scan for received outputs.
 *
 * If you have the nonce (derived from your keys), you can rewind the range proof
 * to extract the actual value and blinding factor. This is how wallets detect
 * which outputs belong to them.
 *
 * @param nonce - Rewind nonce (derived from your scan key)
 * @param commitment - Pedersen commitment
 * @param proof - Range proof
 * @returns Extracted value, blind, and message
 */
export function rewindRangeProof(
  nonce: Uint8Array,
  commitment: Commitment,
  proof: Uint8Array
): {
  blind: Blind;
  value: bigint;
  minValue: bigint;
  maxValue: bigint;
  message: Uint8Array;
} {
  const wasm = getWasm();

  try {
    const resultJson = wasm.rangeproofRewind(nonce, commitment, proof);
    debug('[rewindRangeProof] Raw result:', resultJson);

    const result = JSON.parse(resultJson);
    debug('[rewindRangeProof] Parsed result:', result);

    if (result.error) {
      throw new Error(`Range proof rewind failed: ${result.error}`);
    }

    return {
      blind: hexToBytes(result.blind),
      value: BigInt(result.value),
      minValue: BigInt(result.minValue),
      maxValue: BigInt(result.maxValue),
      message: hexToBytes(result.message),
    };
  } catch (error: any) {
    // console.error('[rewindRangeProof] Error:', error);
    throw new Error(`Could not rewind range proof: ${error.message || error}`);
  }
}

/**
 * Derive a public key from a secret key
 */
export function derivePublicKey(secret: SecretKey): PublicKey {
  const wasm = getWasm();
  return wasm.derivePubkey(secret);
}

/**
 * Add a scalar * G to a public key point
 */
export function pointAddScalar(pubkey: PublicKey, scalar: Uint8Array): PublicKey {
  const wasm = getWasm();
  return wasm.pointAddScalar(pubkey, scalar);
}

/**
 * Multiply a public key point by a scalar
 */
export function pointMultiply(pubkey: PublicKey, scalar: SecretKey): PublicKey {
  const wasm = getWasm();
  return wasm.pointMultiply(pubkey, scalar);
}

/**
 * Add two private keys (mod curve order)
 */
export function privateAdd(a: SecretKey, b: SecretKey): SecretKey {
  const wasm = getWasm();
  return wasm.privateAdd(a, b);
}

// ============================================================================
// MLSAG Signature Operations
// ============================================================================

/**
 * Prepare MLSAG signature data
 *
 * This calculates the blind sum and creates the M matrix for signing
 */
export function prepareMlsag(params: {
  m: Uint8Array;
  nOuts: number;
  nBlinded: number;
  vpInCommitsLen: number;
  vpBlindsLen: number;
  nCols: number;
  nRows: number;
  vpInCommits: Uint8Array[];
  vpOutCommits: Uint8Array[];
  vpBlinds: Uint8Array[];
}): { m: Uint8Array; sk: Uint8Array } {
  const wasm = getWasm();

  // Convert arrays to JSON
  const pcmInJson = JSON.stringify(params.vpInCommits.map(bytesToHex));
  const pcmOutJson = JSON.stringify(params.vpOutCommits.map(bytesToHex));
  const blindsJson = JSON.stringify(params.vpBlinds.map(bytesToHex));

  const resultJson = wasm.prepareMlsag(
    bytesToHex(params.m),
    params.nOuts,
    params.nBlinded,
    params.vpInCommitsLen,
    params.vpBlindsLen,
    params.nCols,
    params.nRows,
    pcmInJson,
    pcmOutJson,
    blindsJson
  );

  const result = JSON.parse(resultJson);

  return {
    m: hexToBytes(result.m),
    sk: hexToBytes(result.sk),
  };
}

/**
 * Generate MLSAG signature
 *
 * Creates the actual ring signature for the transaction
 */
export function generateMlsag(params: {
  nonce: Uint8Array;
  preimage: Uint8Array;
  nCols: number;
  nRows: number;
  index: number;
  secretKeys: Uint8Array[];
  publicKeys: Uint8Array;
}): { keyImages: Uint8Array; pc: Uint8Array; ps: Uint8Array } {
  const wasm = getWasm();

  // Convert secret keys to JSON
  const skJson = JSON.stringify(params.secretKeys.map(bytesToHex));

  const resultJson = wasm.generateMlsag(
    bytesToHex(params.nonce),
    bytesToHex(params.preimage),
    params.nCols,
    params.nRows,
    params.index,
    skJson,
    bytesToHex(params.publicKeys)
  );

  const result = JSON.parse(resultJson);

  return {
    keyImages: hexToBytes(result.keyImages),
    pc: hexToBytes(result.pc),
    ps: hexToBytes(result.ps),
  };
}

/**
 * Verify MLSAG signature
 *
 * Validates that a ring signature is correct
 */
export function verifyMlsag(params: {
  preimage: Uint8Array;
  nCols: number;
  nRows: number;
  publicKeys: Uint8Array;
  keyImages: Uint8Array;
  pc: Uint8Array;
  ps: Uint8Array;
}): boolean {
  const wasm = getWasm();

  try {
    const resultJson = wasm.verifyMlsag(
      bytesToHex(params.preimage),
      params.nCols,
      params.nRows,
      bytesToHex(params.publicKeys),
      bytesToHex(params.keyImages),
      bytesToHex(params.pc),
      bytesToHex(params.ps)
    );

    const result = JSON.parse(resultJson);
    return result.valid;
  } catch (error) {
    // Capture detailed error information
    const errorStr = String(error);
    const errorMsg = error instanceof Error ? error.message : errorStr;

    console.error('[verifyMlsag] WASM call failed');
    console.error('[verifyMlsag] Error type:', typeof error);
    console.error('[verifyMlsag] Error:', error);
    console.error('[verifyMlsag] Error string:', errorStr);
    console.error('[verifyMlsag] Error message:', errorMsg);

    if (error instanceof Error) {
      console.error('[verifyMlsag] Error name:', error.name);
      console.error('[verifyMlsag] Error stack:', error.stack);
    }

    // Re-throw with more context
    throw new Error(`MLSAG verification failed: ${errorMsg}`);
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
