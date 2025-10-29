/**
 * Transaction Serialization for Veil
 *
 * Implements Veil's exact binary transaction format matching:
 * /Users/jeremy/veil/src/primitives/transaction.h:722
 *
 * Format:
 * [Ver1: 1] [Ver2: 1] [HasWitness: 1] [LockTime: 4]
 * [Inputs + scriptData] [Outputs with types] [scriptWitness]
 */

import { Transaction, TxInput, TxOutput, OutputType, TransactionType } from './types';
import { concatBytes } from './utils';
import { debug } from './debug';

/** Anon marker for RingCT inputs */
const ANON_MARKER = 0xffffffa0;

/**
 * Serialize a varInt (variable-length integer)
 *
 * Bitcoin/Veil format:
 * - < 0xfd: 1 byte
 * - <= 0xffff: 0xfd + 2 bytes (LE)
 * - <= 0xffffffff: 0xfe + 4 bytes (LE)
 * - > 0xffffffff: 0xff + 8 bytes (LE)
 */
function serializeVarInt(n: number | bigint): Uint8Array {
  const num = typeof n === 'bigint' ? Number(n) : n;

  if (num < 0xfd) {
    return new Uint8Array([num]);
  } else if (num <= 0xffff) {
    const buf = new Uint8Array(3);
    buf[0] = 0xfd;
    buf[1] = num & 0xff;
    buf[2] = (num >> 8) & 0xff;
    return buf;
  } else if (num <= 0xffffffff) {
    const buf = new Uint8Array(5);
    buf[0] = 0xfe;
    buf[1] = num & 0xff;
    buf[2] = (num >> 8) & 0xff;
    buf[3] = (num >> 16) & 0xff;
    buf[4] = (num >> 24) & 0xff;
    return buf;
  } else {
    const buf = new Uint8Array(9);
    buf[0] = 0xff;
    const bigN = BigInt(num);
    for (let i = 0; i < 8; i++) {
      buf[i + 1] = Number((bigN >> BigInt(i * 8)) & 0xffn);
    }
    return buf;
  }
}

/**
 * Serialize a 32-bit unsigned integer (little-endian)
 */
function serializeUInt32LE(n: number): Uint8Array {
  const buf = new Uint8Array(4);
  buf[0] = n & 0xff;
  buf[1] = (n >> 8) & 0xff;
  buf[2] = (n >> 16) & 0xff;
  buf[3] = (n >> 24) & 0xff;
  return buf;
}

/**
 * Serialize a 64-bit unsigned integer (little-endian)
 */
function serializeUInt64LE(n: bigint): Uint8Array {
  const buf = new Uint8Array(8);
  for (let i = 0; i < 8; i++) {
    buf[i] = Number((n >> BigInt(i * 8)) & 0xffn);
  }
  return buf;
}

/**
 * Serialize a vector (varInt length + data)
 */
function serializeVector(data: Uint8Array): Uint8Array {
  return concatBytes(serializeVarInt(data.length), data);
}

/**
 * Serialize a stack of arrays (varInt count + varInt length + data for each)
 */
function serializeStack(stack: Uint8Array[]): Uint8Array {
  const parts: Uint8Array[] = [serializeVarInt(stack.length)];
  for (const item of stack) {
    parts.push(serializeVarInt(item.length));
    parts.push(item);
  }
  return concatBytes(...parts);
}

/**
 * Serialize a transaction input
 */
function serializeInput(input: TxInput): Uint8Array {
  const parts: Uint8Array[] = [];

  // Previous output hash (32 bytes)
  parts.push(input.prevout.hash);

  // Previous output index (4 bytes, LE)
  parts.push(serializeUInt32LE(input.prevout.n));

  // Script signature (varInt + data)
  parts.push(serializeVector(input.scriptSig));

  // Sequence (4 bytes, LE)
  parts.push(serializeUInt32LE(input.nSequence));

  // Script data (if RingCT input with anon marker)
  if (input.prevout.n === ANON_MARKER && input.scriptData) {
    debug(`[serializeInput] Writing scriptData for anon input:`);
    debug(`  scriptData.stack.length: ${input.scriptData.stack.length}`);
    // if (input.scriptData.stack.length > 0) {
    //   console.log(`  scriptData.stack[0] length: ${input.scriptData.stack[0].length} bytes`);
    // }
    const stackSerialized = serializeStack(input.scriptData.stack);
    debug(`  Serialized stack size: ${stackSerialized.length} bytes`);
    parts.push(stackSerialized);
  }

  return concatBytes(...parts);
}

/**
 * Serialize output data (without type byte) for hashing
 * Matches Dart's CTxOutBase.serialize() behavior
 */
export function serializeOutputData(output: TxOutput): Uint8Array {
  const parts: Uint8Array[] = [];

  // Output data (varies by type)
  switch (output.type) {
    case OutputType.OUTPUT_STANDARD:
      if ('scriptPubKey' in output) {
        // Amount (8 bytes, LE)
        parts.push(serializeUInt64LE(output.amount));
        // Script pubkey (varInt + data)
        parts.push(serializeVector(output.scriptPubKey));
      }
      break;

    case OutputType.OUTPUT_CT:
      if ('commitment' in output && 'vData' in output &&
          'scriptPubKey' in output && 'vRangeproof' in output) {
        // Commitment (33 bytes)
        parts.push(output.commitment);
        // vData (varInt + data)
        parts.push(serializeVector(output.vData));
        // Script pubkey (varInt + data)
        parts.push(serializeVector(output.scriptPubKey));
        // Range proof (varInt + data)
        parts.push(serializeVector(output.vRangeproof));
      }
      break;

    case OutputType.OUTPUT_RINGCT:
      if ('pk' in output && 'commitment' in output &&
          'vData' in output && 'vRangeproof' in output) {
        // Destination public key (33 bytes)
        parts.push(output.pk);
        // Commitment (33 bytes)
        parts.push(output.commitment);
        // vData (varInt + data)
        parts.push(serializeVector(output.vData));
        // Range proof (varInt + data)
        parts.push(serializeVector(output.vRangeproof));
      }
      break;

    case OutputType.OUTPUT_DATA:
      if ('vData' in output) {
        // Data (varInt + data)
        parts.push(serializeVector(output.vData));
      }
      break;

    default:
      throw new Error(`Unsupported output type: ${(output as any).type}`);
  }

  return concatBytes(...parts);
}

/**
 * Serialize a transaction output (with type byte)
 * Used for full transaction serialization
 */
export function serializeOutput(output: TxOutput): Uint8Array {
  const typeByte = new Uint8Array([output.type]);
  const data = serializeOutputData(output);
  return concatBytes(typeByte, data);
}

/**
 * Serialize a Veil transaction
 *
 * Matches Veil Core format from transaction.h:722
 *
 * @param tx - Transaction to serialize
 * @returns Hex-encoded transaction
 */
export function serializeTransaction(tx: Transaction): string {
  const parts: Uint8Array[] = [];

  // 1. Version bytes (2 bytes)
  const version = tx.version || 2;
  const txType = tx.txType || TransactionType.STANDARD;
  const nVersion = (txType << 8) | version;

  parts.push(new Uint8Array([nVersion & 0xff])); // Low byte
  parts.push(new Uint8Array([(nVersion >> 8) & 0xff])); // High byte / type

  // 2. Has witness flag (1 byte)
  parts.push(new Uint8Array([tx.hasWitness ? 1 : 0]));

  // 3. Lock time (4 bytes, LE)
  parts.push(serializeUInt32LE(tx.lockTime || 0));

  // 4. Input count (varInt)
  parts.push(serializeVarInt(tx.inputs.length));

  // 5. Inputs
  for (const input of tx.inputs) {
    parts.push(serializeInput(input));
  }

  // 6. Output count (varInt)
  parts.push(serializeVarInt(tx.outputs.length));

  // 7. Outputs
  for (const output of tx.outputs) {
    parts.push(serializeOutput(output));
  }

  // 8. Witness data (if present)
  if (tx.hasWitness && tx.witness) {
    for (const scriptWitness of tx.witness.scriptWitness) {
      parts.push(serializeStack(scriptWitness.stack));
    }
  }

  // Concatenate all parts
  const serialized = concatBytes(...parts);

  // Convert to hex
  return Array.from(serialized)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Deserialize a varInt
 */
function deserializeVarInt(bytes: Uint8Array, offset: { value: number }): number {
  const first = bytes[offset.value++];
  if (first < 0xfd) {
    return first;
  } else if (first === 0xfd) {
    const value = bytes[offset.value] | (bytes[offset.value + 1] << 8);
    offset.value += 2;
    return value;
  } else if (first === 0xfe) {
    const value =
      bytes[offset.value] |
      (bytes[offset.value + 1] << 8) |
      (bytes[offset.value + 2] << 16) |
      (bytes[offset.value + 3] << 24);
    offset.value += 4;
    return value >>> 0;
  } else {
    // 0xff - 8 bytes
    let value = 0;
    for (let i = 0; i < 8; i++) {
      value |= bytes[offset.value + i] << (i * 8);
    }
    offset.value += 8;
    return value;
  }
}

/**
 * Deserialize a uint32 LE
 */
function deserializeUInt32LE(bytes: Uint8Array, offset: { value: number }): number {
  const value =
    bytes[offset.value] |
    (bytes[offset.value + 1] << 8) |
    (bytes[offset.value + 2] << 16) |
    (bytes[offset.value + 3] << 24);
  offset.value += 4;
  return value >>> 0;
}

/**
 * Deserialize a uint64 LE
 */
function deserializeUInt64LE(bytes: Uint8Array, offset: { value: number }): bigint {
  let value = 0n;
  for (let i = 0; i < 8; i++) {
    value |= BigInt(bytes[offset.value + i]) << BigInt(i * 8);
  }
  offset.value += 8;
  return value;
}

/**
 * Deserialize bytes
 */
function deserializeBytes(bytes: Uint8Array, offset: { value: number }, n: number): Uint8Array {
  const result = bytes.slice(offset.value, offset.value + n);
  offset.value += n;
  return result;
}

/**
 * Deserialize a vector (varInt length + data)
 */
function deserializeVector(bytes: Uint8Array, offset: { value: number }): Uint8Array {
  const length = deserializeVarInt(bytes, offset);
  return deserializeBytes(bytes, offset, length);
}

/**
 * Deserialize a stack (varInt count + varInt length + data for each)
 */
function deserializeStack(bytes: Uint8Array, offset: { value: number }): Uint8Array[] {
  const count = deserializeVarInt(bytes, offset);
  const stack: Uint8Array[] = [];
  for (let i = 0; i < count; i++) {
    stack.push(deserializeVector(bytes, offset));
  }
  return stack;
}

/**
 * Deserialize a Veil transaction from hex
 *
 * @param hex - Hex-encoded transaction
 * @returns Parsed transaction
 */
export function deserializeTransaction(hex: string): Transaction {
  // Convert hex to bytes
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }

  const offset = { value: 0 };

  // 1. Version bytes (2 bytes)
  const versionLow = bytes[offset.value++];
  const versionHigh = bytes[offset.value++];
  const nVersion = versionLow | (versionHigh << 8);
  const version = nVersion & 0xff;
  const txType = (nVersion >> 8) & 0xff;

  // 2. Has witness flag (1 byte)
  const hasWitness = bytes[offset.value++] === 1;

  // 3. Lock time (4 bytes, LE)
  const lockTime = deserializeUInt32LE(bytes, offset);

  // 4. Input count (varInt)
  const numInputs = deserializeVarInt(bytes, offset);

  // 5. Inputs
  const inputs: TxInput[] = [];
  for (let i = 0; i < numInputs; i++) {
    const hash = deserializeBytes(bytes, offset, 32);
    const n = deserializeUInt32LE(bytes, offset);
    const scriptSig = deserializeVector(bytes, offset);
    const nSequence = deserializeUInt32LE(bytes, offset);

    let scriptData: { stack: Uint8Array[] } | undefined;
    if (n === ANON_MARKER) {
      scriptData = { stack: deserializeStack(bytes, offset) };
    }

    inputs.push({
      prevout: { hash, n },
      scriptSig,
      nSequence,
      scriptData,
      ring: [], // Unknown when deserializing
      keyImage: new Uint8Array(33), // Will be in scriptData
      secretIndex: 0,
      secretKey: new Uint8Array(32),
    });
  }

  // 6. Output count (varInt)
  const numOutputs = deserializeVarInt(bytes, offset);

  // 7. Outputs
  const outputs: TxOutput[] = [];
  for (let i = 0; i < numOutputs; i++) {
    const outputType = bytes[offset.value++];

    switch (outputType) {
      case OutputType.OUTPUT_STANDARD: {
        const amount = deserializeUInt64LE(bytes, offset);
        const scriptPubKey = deserializeVector(bytes, offset);
        outputs.push({
          type: OutputType.OUTPUT_STANDARD,
          address: '',
          amount,
          scriptPubKey,
        });
        break;
      }

      case OutputType.OUTPUT_CT: {
        const commitment = deserializeBytes(bytes, offset, 33);
        const vData = deserializeVector(bytes, offset);
        const scriptPubKey = deserializeVector(bytes, offset);
        const vRangeproof = deserializeVector(bytes, offset);
        outputs.push({
          type: OutputType.OUTPUT_CT,
          address: '',
          amount: 0n, // Hidden
          commitment,
          vData,
          scriptPubKey,
          vRangeproof,
        });
        break;
      }

      case OutputType.OUTPUT_RINGCT: {
        const pk = deserializeBytes(bytes, offset, 33);
        const commitment = deserializeBytes(bytes, offset, 33);
        const vData = deserializeVector(bytes, offset);
        const vRangeproof = deserializeVector(bytes, offset);
        outputs.push({
          type: OutputType.OUTPUT_RINGCT,
          address: '',
          amount: 0n, // Hidden
          pk,
          commitment,
          vData,
          vRangeproof,
        });
        break;
      }

      case OutputType.OUTPUT_DATA: {
        const vData = deserializeVector(bytes, offset);
        outputs.push({
          type: OutputType.OUTPUT_DATA,
          address: '',
          amount: 0n,
          vData,
        });
        break;
      }

      default:
        throw new Error(`Unknown output type: ${outputType}`);
    }
  }

  // 8. Witness data (if present)
  let witness: { scriptWitness: Array<{ stack: Uint8Array[] }> } | undefined;
  if (hasWitness) {
    witness = { scriptWitness: [] };
    for (let i = 0; i < numInputs; i++) {
      witness.scriptWitness.push({
        stack: deserializeStack(bytes, offset),
      });
    }
  }

  return {
    version,
    txType,
    hasWitness,
    lockTime,
    inputs,
    outputs,
    ringSize: inputs[0]?.ring.length || 0,
    witness,
    fee: 0n,
  };
}

/**
 * Calculate the size of a serialized transaction in bytes
 *
 * @param tx - Transaction to measure
 * @returns Size in bytes
 */
export function calculateTransactionSize(tx: Transaction): number {
  // Simply serialize and measure
  const hex = serializeTransaction(tx);
  return hex.length / 2;
}
