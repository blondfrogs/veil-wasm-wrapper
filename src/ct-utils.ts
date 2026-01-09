/**
 * CT (Confidential Transaction) Utilities
 *
 * This module provides utilities for spending CT outputs:
 * - Sighash calculation for CT inputs
 * - P2PKH script operations
 * - CT input serialization
 */

import { sha256, doubleSha256, hash160, ripemd160 } from './crypto';
import { concatBytes, hexToBytes, bytesToHex } from './utils';
import { PublicKey, SecretKey, Commitment, TxInputCT, UTXO_CT, TxOutput, OutputType } from './types';

// ============================================================================
// Constants
// ============================================================================

/** SIGHASH_ALL - sign all inputs and outputs */
export const SIGHASH_ALL = 0x01;

/** Sequence number for non-RBF transactions */
export const SEQUENCE_FINAL = 0xffffffff;

/** Sequence for RBF (BIP125) */
export const SEQUENCE_RBF = 0xfffffffe;

// ============================================================================
// P2PKH Script Operations
// ============================================================================

/**
 * Create a P2PKH scriptPubKey from a public key
 *
 * Format: OP_DUP OP_HASH160 <20-byte pubkey hash> OP_EQUALVERIFY OP_CHECKSIG
 *
 * @param pubkey - 33-byte compressed public key
 * @returns P2PKH scriptPubKey (25 bytes)
 */
export async function createP2PKHScriptPubKey(pubkey: PublicKey): Promise<Uint8Array> {
  // Hash160 = RIPEMD160(SHA256(pubkey))
  const pubkeyHash = await hash160(pubkey);

  // OP_DUP (0x76) OP_HASH160 (0xa9) PUSH20 (0x14) <hash> OP_EQUALVERIFY (0x88) OP_CHECKSIG (0xac)
  return concatBytes(
    new Uint8Array([0x76, 0xa9, 0x14]),  // OP_DUP OP_HASH160 PUSH20
    pubkeyHash,                           // 20-byte pubkey hash
    new Uint8Array([0x88, 0xac])          // OP_EQUALVERIFY OP_CHECKSIG
  );
}

/**
 * Create a P2PKH scriptSig from a signature and public key
 *
 * Format: <sig> <pubkey>
 *
 * @param signature - DER-encoded ECDSA signature
 * @param pubkey - 33-byte compressed public key
 * @param sighashType - Sighash type (default: SIGHASH_ALL)
 * @returns P2PKH scriptSig
 */
export function createP2PKHScriptSig(
  signature: Uint8Array,
  pubkey: PublicKey,
  sighashType: number = SIGHASH_ALL
): Uint8Array {
  // Append sighash type to signature
  const sigWithHashType = concatBytes(signature, new Uint8Array([sighashType]));

  // Build scriptSig: PUSH(sig) PUSH(pubkey)
  return concatBytes(
    new Uint8Array([sigWithHashType.length]),  // PUSH sig length
    sigWithHashType,                            // signature + sighash type
    new Uint8Array([pubkey.length]),            // PUSH pubkey length
    pubkey                                      // pubkey
  );
}

/**
 * Extract the pubkey hash from a P2PKH scriptPubKey
 *
 * @param scriptPubKey - P2PKH script (25 bytes)
 * @returns 20-byte pubkey hash, or null if not P2PKH
 */
export function extractP2PKHHash(scriptPubKey: Uint8Array): Uint8Array | null {
  // P2PKH format: 76 a9 14 <20 bytes> 88 ac
  if (scriptPubKey.length !== 25) return null;
  if (scriptPubKey[0] !== 0x76) return null;  // OP_DUP
  if (scriptPubKey[1] !== 0xa9) return null;  // OP_HASH160
  if (scriptPubKey[2] !== 0x14) return null;  // PUSH 20
  if (scriptPubKey[23] !== 0x88) return null; // OP_EQUALVERIFY
  if (scriptPubKey[24] !== 0xac) return null; // OP_CHECKSIG

  return scriptPubKey.slice(3, 23);
}

/**
 * Check if a scriptPubKey is P2PKH
 */
export function isP2PKH(scriptPubKey: Uint8Array): boolean {
  return extractP2PKHHash(scriptPubKey) !== null;
}


// ============================================================================
// Sighash Calculation for CT Inputs
// ============================================================================

/**
 * Compute the sighash for a CT input using standard Bitcoin legacy format
 *
 * IMPORTANT: Veil's sighash computation uses STANDARD BITCOIN FORMAT,
 * not the custom Veil transaction format. This is because the
 * CTransactionSignatureSerializer uses ::Serialize(s, txTo.nVersion)
 * which serializes nVersion as a standard 4-byte int32_t.
 *
 * Format:
 * - nVersion (4 bytes, int32_t LE)
 * - Inputs (varint count + serialized inputs)
 * - Outputs (varint count + serialized outputs)
 * - nLockTime (4 bytes, uint32_t LE)
 * - nHashType (4 bytes, int32_t LE)
 *
 * @param tx - Partial transaction data
 * @param inputIndex - Index of the input being signed
 * @param scriptPubKey - Script of the output being spent
 * @param commitment - Pedersen commitment (unused in legacy sighash, kept for interface)
 * @param sighashType - Sighash type (default: SIGHASH_ALL)
 * @returns 32-byte sighash
 */
export async function computeCTSighash(
  tx: {
    version: number;
    inputs: Array<{ prevout: { hash: Uint8Array; n: number }; nSequence: number }>;
    outputs: TxOutput[];
    lockTime: number;
  },
  inputIndex: number,
  scriptPubKey: Uint8Array,
  commitment: Commitment,
  sighashType: number = SIGHASH_ALL
): Promise<Uint8Array> {
  const parts: Uint8Array[] = [];

  // Version (4 bytes, int32_t LE) - standard Bitcoin format for sighash
  const versionBytes = new Uint8Array(4);
  new DataView(versionBytes.buffer).setInt32(0, tx.version, true);
  parts.push(versionBytes);

  // Number of inputs (varint)
  parts.push(encodeVarInt(tx.inputs.length));

  // Serialize each input
  for (let i = 0; i < tx.inputs.length; i++) {
    const input = tx.inputs[i];

    // Prevout hash (32 bytes, internal byte order)
    parts.push(input.prevout.hash);

    // Prevout index (4 bytes LE)
    const nBytes = new Uint8Array(4);
    new DataView(nBytes.buffer).setUint32(0, input.prevout.n, true);
    parts.push(nBytes);

    // scriptSig: empty for all except the input being signed
    if (i === inputIndex) {
      // Use the scriptPubKey of the output being spent
      parts.push(encodeVarInt(scriptPubKey.length));
      parts.push(scriptPubKey);
    } else {
      // Empty scriptSig
      parts.push(new Uint8Array([0x00]));
    }

    // Sequence (4 bytes LE)
    const seqBytes = new Uint8Array(4);
    new DataView(seqBytes.buffer).setUint32(0, input.nSequence, true);
    parts.push(seqBytes);
  }

  // Number of outputs (varint)
  parts.push(encodeVarInt(tx.outputs.length));

  // Serialize each output for sighash
  const outputsData = await serializeOutputsForLegacySighash(tx.outputs);
  parts.push(outputsData);

  // LockTime (4 bytes LE)
  const locktimeBytes = new Uint8Array(4);
  new DataView(locktimeBytes.buffer).setUint32(0, tx.lockTime, true);
  parts.push(locktimeBytes);

  // Sighash type (4 bytes LE) - appended AFTER the transaction
  const sighashBytes = new Uint8Array(4);
  new DataView(sighashBytes.buffer).setInt32(0, sighashType, true);
  parts.push(sighashBytes);

  // Double SHA256 the entire thing
  return doubleSha256(concatBytes(...parts));
}

/**
 * Serialize outputs for legacy sighash calculation
 *
 * IMPORTANT: For sighash, outputs are serialized WITHOUT the type byte prefix.
 * The type byte is only included in transaction serialization (SerializeTransaction),
 * not in CTransactionSignatureSerializer which is used for sighash.
 *
 * Looking at CTxOutRingCT::Serialize in transaction.h:520-523:
 *   s.write((char*)pk.begin(), 33);
 *   s.write((char*)&commitment.data[0], 33);
 *   s << vData;
 *   s << vRangeproof;
 */
async function serializeOutputsForLegacySighash(outputs: TxOutput[]): Promise<Uint8Array> {
  const parts: Uint8Array[] = [];

  for (const output of outputs) {
    switch (output.type) {
      case OutputType.OUTPUT_RINGCT: {
        // RingCT output: pk (33) + commitment (33) + vData + vRangeproof
        // NO type byte for sighash!
        if ('pk' in output && 'commitment' in output) {
          parts.push(output.pk);
          parts.push(output.commitment);
          parts.push(encodeVarInt(output.vData.length));
          parts.push(output.vData);
          parts.push(encodeVarInt(output.vRangeproof.length));
          parts.push(output.vRangeproof);
        }
        break;
      }
      case OutputType.OUTPUT_CT: {
        // CT output: commitment (33) + vData + scriptPubKey + vRangeproof
        // NO type byte for sighash!
        if ('commitment' in output && 'scriptPubKey' in output) {
          parts.push(output.commitment);
          parts.push(encodeVarInt(output.vData.length));
          parts.push(output.vData);
          parts.push(encodeVarInt(output.scriptPubKey.length));
          parts.push(output.scriptPubKey);
          parts.push(encodeVarInt(output.vRangeproof.length));
          parts.push(output.vRangeproof);
        }
        break;
      }
      case OutputType.OUTPUT_DATA: {
        // Data output: just vData
        // NO type byte for sighash!
        if ('vData' in output) {
          parts.push(encodeVarInt(output.vData.length));
          parts.push(output.vData);
        }
        break;
      }
      case OutputType.OUTPUT_STANDARD: {
        // Standard output: value (8) + scriptPubKey
        // NO type byte for sighash!
        if ('scriptPubKey' in output) {
          const valueBytes = new Uint8Array(8);
          new DataView(valueBytes.buffer).setBigInt64(0, output.amount, true);
          parts.push(valueBytes);
          parts.push(encodeVarInt(output.scriptPubKey.length));
          parts.push(output.scriptPubKey);
        }
        break;
      }
    }
  }

  return concatBytes(...parts);
}

// ============================================================================
// Serialization Helpers
// ============================================================================

/**
 * Encode a variable-length integer (Bitcoin varint)
 */
function encodeVarInt(n: number): Uint8Array {
  if (n < 0xfd) {
    return new Uint8Array([n]);
  } else if (n <= 0xffff) {
    const bytes = new Uint8Array(3);
    bytes[0] = 0xfd;
    new DataView(bytes.buffer).setUint16(1, n, true);
    return bytes;
  } else if (n <= 0xffffffff) {
    const bytes = new Uint8Array(5);
    bytes[0] = 0xfe;
    new DataView(bytes.buffer).setUint32(1, n, true);
    return bytes;
  } else {
    const bytes = new Uint8Array(9);
    bytes[0] = 0xff;
    new DataView(bytes.buffer).setBigUint64(1, BigInt(n), true);
    return bytes;
  }
}

/**
 * Serialize a CT input for inclusion in transaction
 */
export function serializeCTInput(input: TxInputCT): Uint8Array {
  const parts: Uint8Array[] = [];

  // Prevout hash (32 bytes) - already in internal byte order
  parts.push(input.prevout.hash);

  // Prevout index (4 bytes, little-endian)
  const nBytes = new Uint8Array(4);
  new DataView(nBytes.buffer).setUint32(0, input.prevout.n, true);
  parts.push(nBytes);

  // scriptSig (with length prefix)
  parts.push(encodeVarInt(input.scriptSig.length));
  parts.push(input.scriptSig);

  // Sequence (4 bytes, little-endian)
  const seqBytes = new Uint8Array(4);
  new DataView(seqBytes.buffer).setUint32(0, input.nSequence, true);
  parts.push(seqBytes);

  return concatBytes(...parts);
}

/**
 * Derive the spend key for a CT output
 *
 * This computes: spendKey = spendSecret + sharedSecret
 * where sharedSecret = SHA256(scanSecret * ephemeralPubkey)
 *
 * @param spendSecret - Base spend private key
 * @param scanSecret - Scan private key
 * @param ephemeralPubkey - Ephemeral pubkey from the transaction
 * @returns Derived spend key for this specific output
 */
export async function deriveCTSpendKey(
  spendSecret: SecretKey,
  scanSecret: SecretKey,
  ephemeralPubkey: PublicKey
): Promise<SecretKey> {
  // Import ECDH and privateAdd from wasm
  const { performEcdh, privateAdd } = await import('./wasm');

  // Compute shared secret via ECDH
  const sharedSecret = performEcdh(ephemeralPubkey, scanSecret);

  // Add to spend secret
  return privateAdd(spendSecret, sharedSecret);
}
