/**
 * Stealth Address Operations for Veil
 *
 * Implements stealth address generation, encoding, and ephemeral key derivation
 * Based on the Dart implementation in veil_light_plugin
 */

import { PublicKey, SecretKey, StealthAddress } from './types';
import {
  bytesToHex,
  hexToBytes,
  concatBytes,
  isValidPublicKey,
  isValidSecretKey,
} from './utils';
import {
  sha256,
  hash160,
  getRandomBytes,
  privateAdd,
  derivePublicKey,
  pointAddScalar
} from './crypto';
import { performEcdh } from './wasm';

// ============================================================================
// Constants
// ============================================================================

const EC_COMPRESSED_SIZE = 33;
const EC_SECRET_SIZE = 32;

// ============================================================================
// Stealth Address Encoding
// ============================================================================

/**
 * Stealth address options (bitfield)
 */
export interface StealthAddressOptions {
  options: number;
  numberSignatures: number;
  prefixNumberBits: number;
  prefixBitfield: number;
}

/**
 * Generate a stealth address from scan and spend keys
 *
 * ⚠️ **Advanced API** - Most users should use `createWallet()` instead.
 *
 * This function creates a Veil stealth address from public keys.
 * For creating a complete wallet, use the higher-level `createWallet()` function.
 *
 * @param scanPubkey - Scan public key (33 bytes compressed)
 * @param spendPubkey - Spend public key (33 bytes compressed)
 * @param options - Optional stealth address options
 * @returns Bech32-encoded stealth address starting with 'sv1'
 *
 * @example
 * ```typescript
 * const scanPub = derivePublicKey(scanSecret);
 * const spendPub = derivePublicKey(spendSecret);
 * const address = generateStealthAddress(scanPub, spendPub);
 * console.log(address); // sv1qq...
 * ```
 */
export function generateStealthAddress(
  scanPubkey: PublicKey,
  spendPubkey: PublicKey,
  options: Partial<StealthAddressOptions> = {}
): StealthAddress {
  if (!isValidPublicKey(scanPubkey)) {
    throw new Error('Invalid scan public key');
  }
  if (!isValidPublicKey(spendPubkey)) {
    throw new Error('Invalid spend public key');
  }

  // Build the raw stealth address data
  const opts = {
    options: options.options ?? 0,
    numberSignatures: options.numberSignatures ?? 0,
    prefixNumberBits: options.prefixNumberBits ?? 0,
    prefixBitfield: options.prefixBitfield ?? 0,
  };

  // Format: [options:1] [scanPubkey:33] [spendPubkeys:1] [spendPubkey:33] [numSigs:1] [prefixBits:1] [prefix:0-4]
  const buffer = new Uint8Array(512);
  let offset = 0;

  // Options byte
  buffer[offset++] = opts.options;

  // Scan pubkey
  buffer.set(scanPubkey, offset);
  offset += EC_COMPRESSED_SIZE;

  // Number of spend pubkeys (always 1 for Veil)
  buffer[offset++] = 1;

  // Spend pubkey
  buffer.set(spendPubkey, offset);
  offset += EC_COMPRESSED_SIZE;

  // Number of signatures required
  buffer[offset++] = opts.numberSignatures;

  // Prefix bits
  buffer[offset++] = opts.prefixNumberBits;

  // Prefix bitfield (if any)
  const prefixBytes = Math.ceil(opts.prefixNumberBits / 8);
  if (prefixBytes >= 1) {
    const view = new DataView(buffer.buffer);
    view.setUint32(offset, opts.prefixBitfield, false); // Big endian
    offset += 4;
  }

  // Encode as bech32
  const data = buffer.slice(0, offset);
  return encodeBech32StealthAddress(data);
}

/**
 * Get bech32 encoding constant for Veil
 * Veil uses standard Bech32 (constant = 1) for stealth addresses
 */
function getVeilBech32Constant(): number {
  return 1; // Standard Bech32 (not Bech32m which uses 0x2bc830a3)
}

/**
 * Decode a stealth address from bech32 format
 *
 * @param address - Bech32-encoded stealth address (starts with 'sv1')
 * @returns Decoded stealth address components
 */
export function decodeStealthAddress(address: StealthAddress): {
  scanPubkey: PublicKey;
  spendPubkey: PublicKey;
  options: number;
  numberSignatures: number;
  prefixNumberBits: number;
  prefixBitfield: number;
} {
  if (!address.startsWith('sv1')) {
    throw new Error('Invalid stealth address: must start with sv1');
  }

  // Decode bech32
  const data = decodeBech32StealthAddress(address);

  // Parse the data
  let offset = 0;

  // Options byte
  const options = data[offset++];

  // Scan pubkey
  const scanPubkey = data.slice(offset, offset + EC_COMPRESSED_SIZE);
  offset += EC_COMPRESSED_SIZE;

  // Number of spend pubkeys
  const numSpendPubkeys = data[offset++];

  // Spend pubkey(s)
  const spendPubkey = data.slice(offset, offset + EC_COMPRESSED_SIZE * numSpendPubkeys);
  offset += EC_COMPRESSED_SIZE * numSpendPubkeys;

  // Number of signatures
  const numberSignatures = data[offset++];

  // Prefix bits
  const prefixNumberBits = data[offset++];

  // Prefix bitfield
  let prefixBitfield = 0;
  const prefixBytes = Math.ceil(prefixNumberBits / 8);
  if (prefixBytes >= 1) {
    const view = new DataView(data.buffer, data.byteOffset);
    prefixBitfield = view.getUint32(offset, false); // Big endian
  }

  return {
    scanPubkey,
    spendPubkey,
    options,
    numberSignatures,
    prefixNumberBits,
    prefixBitfield,
  };
}

// ============================================================================
// Ephemeral Key Generation
// ============================================================================

/**
 * Result of ephemeral key generation
 */
export interface EphemeralKeyResult {
  /** Ephemeral public key (to include in tx) */
  ephemeralPubkey: PublicKey;
  /** Shared secret (from ECDH) */
  sharedSecret: Uint8Array;
  /** Destination public key (where funds are sent) */
  destPubkey: PublicKey;
  /** Ephemeral secret key (for sender only) */
  ephemeralSecret: SecretKey;
}

/**
 * Generate ephemeral keys for a recipient's stealth address
 *
 * This creates a one-time address for the recipient that only they can detect and spend
 *
 * @param recipientAddress - Recipient's stealth address
 * @returns Ephemeral key data for transaction
 */
export async function generateEphemeralKeys(
  recipientAddress: StealthAddress
): Promise<EphemeralKeyResult> {
  // 1. Decode the stealth address
  const { scanPubkey, spendPubkey } = decodeStealthAddress(recipientAddress);

  // 2. Generate random ephemeral secret
  const ephemeralSecret = getRandomBytes(32);

  // 3. Derive ephemeral pubkey from ephemeral secret
  // ephemeralPubkey = ephemeralSecret * G
  // For now we'll use a workaround - we need to add this to WASM
  const ephemeralPubkey = await derivePublicKeyFromSecret(ephemeralSecret);

  // 4. Compute shared secret via ECDH
  // sharedSecret = SHA256(ephemeralSecret * scanPubkey)
  // Note: performEcdh already hashes the result, so we don't hash again
  const sharedSecret = performEcdh(scanPubkey, ephemeralSecret);

  // 5. Derive destination pubkey
  // destPubkey = spendPubkey + (sharedSecret * G)
  const destPubkey = await deriveDestinationKey(spendPubkey, sharedSecret);

  return {
    ephemeralPubkey,
    sharedSecret,
    destPubkey,
    ephemeralSecret,
  };
}

/**
 * Derive the destination public key for a stealth payment
 *
 * destKey = spendPubkey + hash(sharedSecret) * G
 *
 * This is equivalent to the Dart implementation's pointAddScalar
 */
async function deriveDestinationKey(
  spendPubkey: PublicKey,
  sharedSecret: Uint8Array
): Promise<PublicKey> {
  // R = spendPubkey + sharedSecret * G
  return pointAddScalar(spendPubkey, sharedSecret);
}

/**
 * Recover the spend key for a received stealth payment
 *
 * This is used by the recipient to spend the received output
 *
 * @param spendSecret - Recipient's spend secret key
 * @param sharedSecret - Shared secret derived from ephemeral key
 * @returns Secret key to spend this output
 */
export function deriveSpendKey(
  spendSecret: SecretKey,
  sharedSecret: Uint8Array
): SecretKey {
  // spendKey = spendSecret + sharedSecret (mod n)
  return privateAdd(spendSecret, sharedSecret);
}

/**
 * Compute stealth shared secret
 *
 * Ported from Dart implementation
 *
 * @param ephemeralSecret - Sender's ephemeral secret key
 * @param scanPubkey - Recipient's scan public key
 * @param spendPubkey - Recipient's spend public key
 * @returns Shared secret and destination public key
 */
export async function stealthSecret(
  ephemeralSecret: SecretKey,
  scanPubkey: PublicKey,
  spendPubkey: PublicKey
): Promise<{ sharedSecret: Uint8Array; destPubkey: PublicKey }> {
  if (scanPubkey.length !== EC_COMPRESSED_SIZE) {
    throw new Error('scanPubkey must be 33 bytes (compressed)');
  }
  if (spendPubkey.length !== EC_COMPRESSED_SIZE) {
    throw new Error('spendPubkey must be 33 bytes (compressed)');
  }

  // 1. Q = ephemeralSecret * scanPubkey (ECDH)
  // Note: performEcdh already returns SHA256(Q), so no need to hash again
  const sharedSecret = performEcdh(scanPubkey, ephemeralSecret);

  // 3. R = spendPubkey + sharedSecret * G
  const destPubkey = await deriveDestinationKey(spendPubkey, sharedSecret);

  return { sharedSecret, destPubkey };
}

// ============================================================================
// Bech32 Encoding (Simplified)
// ============================================================================

/**
 * Encode stealth address data as bech32 with 'sv1' prefix
 */
function encodeBech32StealthAddress(data: Uint8Array): string {
  // Convert 8-bit data to 5-bit groups for bech32
  const words = convertBits(data, 8, 5, true);

  // Encode as bech32 with standard Bech32 constant (1)
  const encoded = bech32Encode('sv', Array.from(words), getVeilBech32Constant());

  return encoded;
}

/**
 * Decode bech32 stealth address to raw data
 */
function decodeBech32StealthAddress(address: string): Uint8Array {
  const { prefix, words } = bech32Decode(address, getVeilBech32Constant());

  if (prefix !== 'sv') {
    throw new Error('Invalid stealth address prefix');
  }

  // Convert 5-bit groups back to 8-bit data
  const data = convertBits(new Uint8Array(words), 5, 8, false);

  return data;
}

/**
 * Convert between bit groups (for bech32 encoding)
 */
function convertBits(
  data: Uint8Array,
  fromBits: number,
  toBits: number,
  pad: boolean
): Uint8Array {
  let acc = 0;
  let bits = 0;
  const result: number[] = [];
  const maxv = (1 << toBits) - 1;

  for (let i = 0; i < data.length; i++) {
    const value = data[i];
    if (value < 0 || value >> fromBits !== 0) {
      throw new Error('Invalid data');
    }
    acc = (acc << fromBits) | value;
    bits += fromBits;
    while (bits >= toBits) {
      bits -= toBits;
      result.push((acc >> bits) & maxv);
    }
  }

  if (pad) {
    if (bits > 0) {
      result.push((acc << (toBits - bits)) & maxv);
    }
  } else if (bits >= fromBits || ((acc << (toBits - bits)) & maxv)) {
    throw new Error('Invalid padding');
  }

  return new Uint8Array(result);
}

/**
 * Bech32 character set
 */
const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';

/**
 * Bech32 polymod for checksum
 */
function polymod(values: number[]): number {
  let chk = 1;
  const GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];

  for (const value of values) {
    const b = chk >> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ value;
    for (let i = 0; i < 5; i++) {
      if ((b >> i) & 1) {
        chk ^= GEN[i];
      }
    }
  }

  return chk;
}

/**
 * Expand HRP for bech32 checksum
 */
function hrpExpand(hrp: string): number[] {
  const result: number[] = [];
  for (let i = 0; i < hrp.length; i++) {
    result.push(hrp.charCodeAt(i) >> 5);
  }
  result.push(0);
  for (let i = 0; i < hrp.length; i++) {
    result.push(hrp.charCodeAt(i) & 31);
  }
  return result;
}

/**
 * Create bech32 checksum
 */
function createChecksum(hrp: string, data: number[], encodingConst: number): number[] {
  const values = hrpExpand(hrp).concat(data).concat([0, 0, 0, 0, 0, 0]);
  const mod = polymod(values) ^ encodingConst;
  const result: number[] = [];
  for (let i = 0; i < 6; i++) {
    result.push((mod >> (5 * (5 - i))) & 31);
  }
  return result;
}

/**
 * Encode as bech32
 */
function bech32Encode(hrp: string, data: number[], encodingConst: number): string {
  const combined = Array.from(data).concat(createChecksum(hrp, Array.from(data), encodingConst));
  let result = hrp + '1';
  for (const d of combined) {
    result += CHARSET.charAt(d);
  }
  return result;
}

/**
 * Decode bech32
 */
function bech32Decode(
  str: string,
  encodingConst: number
): { prefix: string; words: number[] } {
  if (str.toLowerCase() !== str && str.toUpperCase() !== str) {
    throw new Error('Mixed case string');
  }
  str = str.toLowerCase();

  const pos = str.lastIndexOf('1');
  if (pos < 1 || pos + 7 > str.length || str.length > 122) {
    throw new Error('Invalid bech32 string');
  }

  const hrp = str.substring(0, pos);
  const data: number[] = [];
  for (let i = pos + 1; i < str.length; i++) {
    const d = CHARSET.indexOf(str.charAt(i));
    if (d === -1) {
      throw new Error('Invalid bech32 character');
    }
    data.push(d);
  }

  if (!verifyChecksum(hrp, data, encodingConst)) {
    throw new Error('Invalid bech32 checksum');
  }

  return { prefix: hrp, words: data.slice(0, -6) };
}

/**
 * Verify bech32 checksum
 */
function verifyChecksum(hrp: string, data: number[], encodingConst: number): boolean {
  return polymod(hrpExpand(hrp).concat(data)) === encodingConst;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Derive a public key from a secret key
 */
async function derivePublicKeyFromSecret(secret: SecretKey): Promise<PublicKey> {
  return derivePublicKey(secret);
}

// ============================================================================
// Wallet Generation (High-Level API)
// ============================================================================

/**
 * Complete wallet with keys and address
 */
export interface VeilWallet {
  /** Spend secret key (32 bytes) - KEEP SECRET! */
  spendSecret: SecretKey;
  /** Scan secret key (32 bytes) - KEEP SECRET! */
  scanSecret: SecretKey;
  /** Spend public key (33 bytes) */
  spendPubkey: PublicKey;
  /** Scan public key (33 bytes) */
  scanPubkey: PublicKey;
  /** Stealth address (starts with 'sv1') */
  stealthAddress: StealthAddress;
  /** Hex-encoded spend secret (for storage/display) */
  spendSecretHex: string;
  /** Hex-encoded scan secret (for storage/display) */
  scanSecretHex: string;
}

/**
 * Create a new Veil wallet (Generate Everything!)
 *
 * This is the simplest way for wallets to create a new address.
 * Just call this function - it generates all keys and the address.
 *
 * @returns Complete wallet with keys and address
 *
 * @example
 * ```typescript
 * // That's it! One function call:
 * const wallet = createWallet();
 *
 * console.log('Your address:', wallet.stealthAddress);
 * console.log('Spend key:', wallet.spendSecretHex);
 * console.log('Scan key:', wallet.scanSecretHex);
 *
 * // IMPORTANT: Back up the spend and scan keys!
 * // Users need these to restore their wallet.
 * ```
 */
export function createWallet(): VeilWallet {
  // Generate random keys
  const spendSecret = getRandomBytes(32);
  const scanSecret = getRandomBytes(32);

  // Derive public keys
  const spendPubkey = derivePublicKey(spendSecret);
  const scanPubkey = derivePublicKey(scanSecret);

  // Generate stealth address
  const stealthAddress = generateStealthAddress(scanPubkey, spendPubkey);

  return {
    spendSecret,
    scanSecret,
    spendPubkey,
    scanPubkey,
    stealthAddress,
    spendSecretHex: bytesToHex(spendSecret),
    scanSecretHex: bytesToHex(scanSecret),
  };
}

/**
 * Restore wallet from private keys
 *
 * Use this when users want to restore their wallet from backup.
 *
 * @param spendSecret - Spend private key (32 bytes or hex string)
 * @param scanSecret - Scan private key (32 bytes or hex string)
 * @returns Restored wallet
 *
 * @example
 * ```typescript
 * const wallet = restoreWallet(
 *   '1234567890abcdef...',  // Spend key hex
 *   'fedcba0987654321...'   // Scan key hex
 * );
 * console.log('Restored address:', wallet.stealthAddress);
 * ```
 */
export function restoreWallet(
  spendSecret: SecretKey | string,
  scanSecret: SecretKey | string
): VeilWallet {
  // Convert hex to bytes if needed
  const spendSecretBytes =
    typeof spendSecret === 'string' ? hexToBytes(spendSecret) : spendSecret;
  const scanSecretBytes =
    typeof scanSecret === 'string' ? hexToBytes(scanSecret) : scanSecret;

  // Validate keys
  if (!isValidSecretKey(spendSecretBytes)) {
    throw new Error('Invalid spend secret key');
  }
  if (!isValidSecretKey(scanSecretBytes)) {
    throw new Error('Invalid scan secret key');
  }

  // Derive public keys
  const spendPubkey = derivePublicKey(spendSecretBytes);
  const scanPubkey = derivePublicKey(scanSecretBytes);

  // Generate stealth address
  const stealthAddress = generateStealthAddress(scanPubkey, spendPubkey);

  return {
    spendSecret: spendSecretBytes,
    scanSecret: scanSecretBytes,
    spendPubkey,
    scanPubkey,
    stealthAddress,
    spendSecretHex: bytesToHex(spendSecretBytes),
    scanSecretHex: bytesToHex(scanSecretBytes),
  };
}

/**
 * Validate a Veil stealth address
 *
 * Checks if an address is properly formatted and can be decoded.
 * Use this before allowing users to send to an address!
 *
 * @param address - Address to validate
 * @returns Validation result with details
 *
 * @example
 * ```typescript
 * const result = validateAddress(userInputAddress);
 *
 * if (result.valid) {
 *   console.log('✅ Valid address');
 *   // Allow user to send
 * } else {
 *   console.error('❌ Invalid:', result.error);
 *   // Show error to user
 * }
 * ```
 */
export function validateAddress(address: string): {
  valid: boolean;
  error?: string;
  details?: {
    prefix: string;
    scanPubkey: PublicKey;
    spendPubkey: PublicKey;
  };
} {
  // Check basic format
  if (typeof address !== 'string') {
    return {
      valid: false,
      error: 'Address must be a string',
    };
  }

  if (address.length === 0) {
    return {
      valid: false,
      error: 'Address cannot be empty',
    };
  }

  // Check prefix
  if (!address.startsWith('sv1')) {
    return {
      valid: false,
      error: 'Invalid address prefix. Veil stealth addresses start with "sv1"',
    };
  }

  // Check minimum length
  if (address.length < 60) {
    return {
      valid: false,
      error: 'Address too short. Veil stealth addresses are longer.',
    };
  }

  // Try to decode
  try {
    const decoded = decodeStealthAddress(address);

    // Validate public keys
    if (!isValidPublicKey(decoded.scanPubkey)) {
      return {
        valid: false,
        error: 'Invalid scan public key in address',
      };
    }

    if (!isValidPublicKey(decoded.spendPubkey)) {
      return {
        valid: false,
        error: 'Invalid spend public key in address',
      };
    }

    return {
      valid: true,
      details: {
        prefix: 'sv1',
        scanPubkey: decoded.scanPubkey,
        spendPubkey: decoded.spendPubkey,
      },
    };
  } catch (error: any) {
    return {
      valid: false,
      error: `Invalid address format: ${error.message}`,
    };
  }
}

/**
 * Quick address validation (returns boolean)
 *
 * Simpler version of validateAddress() that just returns true/false.
 * Use this for quick checks in UI validation.
 *
 * @param address - Address to check
 * @returns true if valid, false otherwise
 *
 * @example
 * ```typescript
 * if (isValidAddress(userInput)) {
 *   // Enable send button
 * } else {
 *   // Show error
 * }
 * ```
 */
export function isValidAddress(address: string): boolean {
  return validateAddress(address).valid;
}
