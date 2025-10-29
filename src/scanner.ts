/**
 * UTXO Scanner for Veil Transactions
 *
 * Scans blockchain outputs to detect owned UTXOs and recover their values
 */

import {
  PublicKey,
  SecretKey,
  TxOutput,
  TxOutputRingCT,
  TxOutputCT,
  OutputType,
  UTXO,
} from './types';
import {
  performEcdh,
  verifyRangeProof,
  rewindRangeProof,
} from './wasm';
import {
  derivePublicKey,
  pointAddScalar,
  sha256,
  privateAdd,
} from './crypto';
import { bytesToHex, hexToBytes } from './utils';

/**
 * Scanned output result
 */
export interface ScannedOutput {
  /** Is this output owned by our wallet? */
  isMine: boolean;
  /** Recovered value (if owned) */
  value?: bigint;
  /** Recovered blinding factor (if owned) */
  blind?: Uint8Array;
  /** Derived spend key for this output (if owned) */
  spendKey?: SecretKey;
  /** Public key for this output */
  pubkey?: PublicKey;
  /** Output index in transaction */
  vout?: number;
  /** Transaction ID */
  txid?: string;
}

/**
 * Check if a RingCT output belongs to us
 *
 * Process:
 * 1. Extract ephemeral pubkey from vData
 * 2. Perform ECDH with our scan key
 * 3. Derive expected destination pubkey
 * 4. Compare with actual output pubkey
 *
 * @param output - RingCT output to check
 * @param scanSecret - Our scan private key
 * @param spendPubkey - Our spend public key
 * @returns Scan result with value if owned
 */
export async function scanRingCTOutput(
  output: TxOutputRingCT,
  scanSecret: SecretKey,
  spendPubkey: PublicKey
): Promise<ScannedOutput> {
  try {
    // 1. Extract ephemeral pubkey from vData
    // Format: [prefix: 1] [ephemeral_pubkey: 33]
    if (output.vData.length < 34) {
      return { isMine: false };
    }

    const ephemeralPubkey = output.vData.slice(1, 34);

    // 2. Perform ECDH to get shared secret
    // Note: performEcdh already returns SHA256 of the ECDH result
    const hash = performEcdh(ephemeralPubkey, scanSecret);

    // 3. Derive expected destination pubkey: spendPubkey + hash*G
    const expectedPubkey = pointAddScalar(spendPubkey, hash);

    // 5. Compare with actual output pubkey
    if (bytesToHex(expectedPubkey) !== bytesToHex(output.pk)) {
      return { isMine: false };
    }

    // 6. This output is ours! Try to recover value and blind
    let value: bigint | undefined;
    let blind: Uint8Array | undefined;

    try {
      // Note: For proper range proof rewinding, we would need the destination secret key
      // to compute the correct nonce via ECDH(ephemeralPubkey, destinationSecret).
      // This simplified scanner uses the shared secret, which may not work for all cases.
      const rewindResult = rewindRangeProof(
        hash,                // nonce (simplified - may not work)
        output.commitment,   // commitment
        output.vRangeproof   // proof
      );

      value = rewindResult.value;
      blind = rewindResult.blind;
    } catch (e) {
      console.warn('Failed to rewind range proof:', e);
    }

    return {
      isMine: true,
      value,
      blind,
      spendKey: hash, // The scalar to add to spend secret
      pubkey: output.pk,
    };
  } catch (e) {
    console.error('Error scanning output:', e instanceof Error ? e.message : e);
    return { isMine: false };
  }
}

/**
 * Check if a CT output belongs to us
 *
 * CT outputs use scriptPubKey instead of destination pubkey,
 * so we need to check the script matches our expected format
 *
 * @param output - CT output to check
 * @param scanSecret - Our scan private key
 * @param spendPubkey - Our spend public key
 * @returns Scan result with value if owned
 */
export async function scanCTOutput(
  output: TxOutputCT,
  scanSecret: SecretKey,
  spendPubkey: PublicKey
): Promise<ScannedOutput> {
  try {
    // 1. Extract ephemeral pubkey from vData
    if (output.vData.length < 34) {
      return { isMine: false };
    }

    const ephemeralPubkey = output.vData.slice(1, 34);

    // 2. Perform ECDH
    const sharedSecret = performEcdh(ephemeralPubkey, scanSecret);

    // 3. Try to rewind range proof
    try {
      const rewindResult = rewindRangeProof(
        sharedSecret,        // nonce
        output.commitment,   // commitment
        output.vRangeproof   // proof
      );

      // Successfully rewound - this is ours!
      return {
        isMine: true,
        value: rewindResult.value,
        blind: rewindResult.blind,
        pubkey: ephemeralPubkey,
      };
    } catch (e) {
      // Not ours or failed to rewind
    }

    return { isMine: false };
  } catch (e) {
    console.error('Error scanning CT output:', e instanceof Error ? e.message : e);
    return { isMine: false };
  }
}

/**
 * Scan a generic output (any type)
 *
 * @param output - Output to scan
 * @param scanSecret - Our scan private key
 * @param spendPubkey - Our spend public key
 * @returns Scan result
 */
export async function scanOutput(
  output: TxOutput,
  scanSecret: SecretKey,
  spendPubkey: PublicKey
): Promise<ScannedOutput> {
  switch (output.type) {
    case OutputType.OUTPUT_RINGCT:
      if ('pk' in output && 'commitment' in output && 'vRangeproof' in output) {
        return scanRingCTOutput(output, scanSecret, spendPubkey);
      }
      break;

    case OutputType.OUTPUT_CT:
      if ('commitment' in output && 'vRangeproof' in output) {
        return scanCTOutput(output, scanSecret, spendPubkey);
      }
      break;

    case OutputType.OUTPUT_STANDARD:
    case OutputType.OUTPUT_DATA:
      // Standard and data outputs are not confidential
      return { isMine: false };

    default:
      return { isMine: false };
  }

  return { isMine: false };
}

/**
 * Scan all outputs in a transaction
 *
 * @param outputs - Transaction outputs
 * @param scanSecret - Our scan private key
 * @param spendPubkey - Our spend public key
 * @param txid - Transaction ID (optional)
 * @returns Array of scan results
 */
export async function scanTransaction(
  outputs: TxOutput[],
  scanSecret: SecretKey,
  spendPubkey: PublicKey,
  txid?: string
): Promise<ScannedOutput[]> {
  const results: ScannedOutput[] = [];

  for (let vout = 0; vout < outputs.length; vout++) {
    const result = await scanOutput(outputs[vout], scanSecret, spendPubkey);

    // Add output index and txid if provided
    if (result.isMine) {
      result.vout = vout;
      result.txid = txid;
    }

    results.push(result);
  }

  return results;
}

/**
 * Convert a scanned output to a UTXO
 *
 * @param scannedOutput - Scanned output result
 * @param spendSecret - Our spend private key
 * @param commitment - Output commitment
 * @param ephemeralPubkey - Ephemeral pubkey from output
 * @param blockHeight - Block height (optional)
 * @returns UTXO ready for spending
 */
export function scannedOutputToUTXO(
  scannedOutput: ScannedOutput,
  spendSecret: SecretKey,
  commitment: Uint8Array,
  ephemeralPubkey: Uint8Array,
  blockHeight?: number
): UTXO | null {
  if (!scannedOutput.isMine || !scannedOutput.value || !scannedOutput.blind) {
    return null;
  }

  // Derive actual spend key for this output
  // actualSpendKey = spendSecret + scannedOutput.spendKey
  const actualSpendKey = scannedOutput.spendKey
    ? privateAdd(spendSecret, scannedOutput.spendKey)
    : spendSecret;

  return {
    txid: scannedOutput.txid || '',
    vout: scannedOutput.vout || 0,
    amount: scannedOutput.value,
    commitment,
    blind: scannedOutput.blind,
    pubkey: scannedOutput.pubkey || new Uint8Array(33),
    ephemeralPubkey,
    blockHeight: blockHeight || 0,
    spendable: true,
  };
}

/**
 * Scan a block's transactions for owned outputs
 *
 * @param transactions - Array of transactions (with outputs)
 * @param scanSecret - Our scan private key
 * @param spendSecret - Our spend private key
 * @param spendPubkey - Our spend public key
 * @param blockHeight - Block height
 * @returns Array of UTXOs we own
 */
export async function scanBlock(
  transactions: Array<{ txid: string; outputs: TxOutput[] }>,
  scanSecret: SecretKey,
  spendSecret: SecretKey,
  spendPubkey: PublicKey,
  blockHeight: number
): Promise<UTXO[]> {
  const utxos: UTXO[] = [];

  for (const tx of transactions) {
    const scannedOutputs = await scanTransaction(
      tx.outputs,
      scanSecret,
      spendPubkey,
      tx.txid
    );

    for (let i = 0; i < scannedOutputs.length; i++) {
      const scanned = scannedOutputs[i];
      const output = tx.outputs[i];

      if (scanned.isMine && 'commitment' in output && 'vData' in output) {
        const ephemeralPubkey = output.vData.slice(1, 34);
        const utxo = scannedOutputToUTXO(
          scanned,
          spendSecret,
          output.commitment,
          ephemeralPubkey,
          blockHeight
        );

        if (utxo) {
          utxos.push(utxo);
        }
      }
    }
  }

  return utxos;
}

/**
 * Helper: Check if we can spend a specific output
 *
 * @param output - Output to check
 * @param scanSecret - Our scan private key
 * @param spendPubkey - Our spend public key
 * @returns True if we can spend this output
 */
export async function canSpendOutput(
  output: TxOutput,
  scanSecret: SecretKey,
  spendPubkey: PublicKey
): Promise<boolean> {
  const result = await scanOutput(output, scanSecret, spendPubkey);
  return result.isMine;
}

/**
 * Helper: Get total balance from scanned outputs
 *
 * @param scannedOutputs - Array of scanned outputs
 * @returns Total balance in satoshis
 */
export function getTotalBalance(scannedOutputs: ScannedOutput[]): bigint {
  return scannedOutputs.reduce((sum, output) => {
    if (output.isMine && output.value !== undefined) {
      return sum + output.value;
    }
    return sum;
  }, 0n);
}
