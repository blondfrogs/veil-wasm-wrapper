/**
 * Transaction Builder for Veil RingCT Transactions
 *
 * Ports the Dart implementation to TypeScript, using pure Rust crypto via WASM
 */

import {
  UTXO,
  UTXO_CT,
  TxInputCT,
  Transaction,
  TxInput,
  TxOutput,
  TxOutputRingCT,
  TxOutputData,
  OutputType,
  DataOutputTypes,
  TransactionType,
  StealthAddress,
  Blind,
  Commitment,
  RangeProof,
  KeyImage,
  PublicKey,
  SecretKey,
} from './types';
import { debug, debugGroup } from './debug';
import {
  createCommitment,
  generateRangeProof,
  sumBlinds,
  generateKeyImage,
  performEcdh,
  privateAdd,
  pointMultiply,
  getWasm,
  initWasm,
  prepareMlsag,
  generateMlsag,
  verifyMlsag,
  ecdsaSign,
} from './wasm';
import {
  computeCTSighash,
  createP2PKHScriptSig,
  serializeCTInput,
  deriveCTSpendKey,
  SIGHASH_ALL,
  SEQUENCE_FINAL,
} from './ct-utils';
import {
  hexToBytes,
  bytesToHex,
  veilToSatoshis,
  satoshisToVeil,
  concatBytes,
  isValidRingSize,
  isValidAmount,
  randomSample,
  shuffleArray,
} from './utils';
import {
  getRandomBytes,
} from './crypto';
import {
  generateStealthAddress,
  generateEphemeralKeys,
} from './stealth';
import {
  derivePublicKey,
  doubleSha256,
  sha256,
} from './crypto';
import {
  selectRangeProofParameters,
  validateRangeProofParams,
} from './range-proof-params';
import {
  serializeTransaction,
  serializeOutput,
  serializeOutputData,
  calculateTransactionSize,
} from './serialization';
import {
  fetchDecoyOutputs,
} from './rpc';

// Constants
export const MIN_RING_SIZE = 3;
export const MAX_RING_SIZE = 32;
export const DEFAULT_RING_SIZE = 11;
export const MAX_ANON_INPUTS = 32; // Maximum inputs per RingCT transaction (consensus rule)
export const DUST_THRESHOLD = 1000; // 0.00001 VEIL
export const DEFAULT_FEE_PER_KB = 10000; // 0.0001 VEIL per KB
export const ANON_MARKER = 0xffffffa0; // Marker for RingCT inputs
export const CONSOLIDATION_THRESHOLD = 10; // Recommend consolidation when UTXOs > this

/**
 * Transaction Builder Configuration
 */
export interface TransactionBuilderConfig {
  /** Ring size for anonymity (3-32) */
  ringSize?: number;
  /** Fee per kilobyte in satoshis */
  feePerKb?: number;
  /** Whether to subtract fee from outputs */
  subtractFeeFromOutputs?: boolean;
}

/**
 * Recipient for a transaction
 */
export interface Recipient {
  /** Destination stealth address */
  address: string;
  /** Amount in satoshis */
  amount: bigint;
  /** Optional narration/memo */
  narration?: string;
}

/**
 * Built transaction result
 */
export interface BuildTransactionResult {
  /** Serialized transaction hex */
  txHex: string;
  /** Transaction ID */
  txid: string;
  /** Transaction fee in satoshis */
  fee: bigint;
  /** Change amount in satoshis */
  change: bigint;
  /** Transaction size in bytes */
  size: number;
  /** Inputs used */
  inputs: UTXO[];
  /** Outputs created */
  outputs: TxOutput[];
}

/**
 * Coin selection result
 */
interface CoinSelectionResult {
  /** Selected UTXOs */
  utxos: UTXO[];
  /** Total input value */
  totalValue: bigint;
  /** Estimated fee */
  fee: bigint;
  /** Change amount */
  change: bigint;
}

/**
 * Transaction Builder for Veil RingCT Transactions
 *
 * Main class for building privacy-preserving RingCT transactions
 */
export class TransactionBuilder {
  private config: Required<TransactionBuilderConfig>;
  private wasmInitialized: boolean = false;

  constructor(config: TransactionBuilderConfig = {}) {
    this.config = {
      ringSize: config.ringSize ?? DEFAULT_RING_SIZE,
      feePerKb: config.feePerKb ?? DEFAULT_FEE_PER_KB,
      subtractFeeFromOutputs: config.subtractFeeFromOutputs ?? false,
    };

    // Validate ring size
    if (!isValidRingSize(this.config.ringSize)) {
      throw new Error(
        `Ring size must be between ${MIN_RING_SIZE} and ${MAX_RING_SIZE}`
      );
    }
  }

  /**
   * Initialize WASM module (must be called before building transactions)
   */
  async initialize(): Promise<void> {
    if (this.wasmInitialized) return;

    await initWasm();
    this.wasmInitialized = true;
  }

  /**
   * Build a RingCT transaction
   *
   * Main entry point for transaction building
   */
  async buildTransaction(
    spendKey: SecretKey,
    scanKey: SecretKey,
    recipients: Recipient[],
    availableUTXOs: UTXO[],
    dummyOutputs: any[] // Decoy outputs from network
  ): Promise<BuildTransactionResult> {
    // Ensure WASM is initialized
    if (!this.wasmInitialized) {
      await this.initialize();
    }

    // Validate inputs
    this.validateTransactionInputs(recipients, availableUTXOs);

    // Calculate total output amount
    const totalOutput = recipients.reduce((sum, r) => sum + r.amount, 0n);

    // Step 1: Select coins to spend
    const coinSelection = this.selectCoins(
      availableUTXOs,
      totalOutput,
      this.config.feePerKb
    );

    // Step 2: Build change output (same address as sender)
    const changeRecipient = this.buildChangeRecipient(
      spendKey,
      scanKey,
      coinSelection.change
    );

    // Step 3: Build recipient outputs with ephemeral keys
    const builtRecipients = await Promise.all(
      recipients.map(r => this.buildRecipientOutput(r))
    );

    // Build change recipient with ephemeral keys (if there's change)
    const builtChangeRecipient = coinSelection.change > 0n
      ? await this.buildRecipientOutput(changeRecipient)
      : null;

    // Step 4: Create transaction structure
    const tx: Partial<Transaction> = {
      version: 2,
      txType: TransactionType.STANDARD,
      hasWitness: true, // RingCT always has witness data
      lockTime: 0,
      inputs: [],
      outputs: [],
      ringSize: this.config.ringSize,
      fee: coinSelection.fee,
    };

    // Step 5: Add outputs with commitments and range proofs
    await this.addCTData(tx, builtRecipients, builtChangeRecipient);

    // Step 6: Add inputs (real + decoys)
    await this.addInputs(
      tx,
      coinSelection.utxos,
      dummyOutputs,
      spendKey,
      scanKey
    );

    // Step 7: Insert key images
    await this.insertKeyImages(tx, coinSelection.utxos, spendKey, scanKey);

    // Step 8: Generate MLSAG signatures
    await this.generateMLSAGSignatures(
      tx,
      coinSelection.utxos,
      dummyOutputs,
      spendKey,
      scanKey
    );

    // Step 9: Serialize transaction
    debug(`\n[buildTransaction] Checking inputs before serialization:`);
    for (let i = 0; i < tx.inputs!.length; i++) {
      const input = tx.inputs![i];
      debug(`  Input ${i}:`);
      debug(`    scriptData exists: ${!!input.scriptData}`);
      debug(`    scriptData.stack length: ${input.scriptData?.stack?.length || 0}`);
      if (input.scriptData?.stack?.[0]) {
        debug(`    scriptData.stack[0] length: ${input.scriptData.stack[0].length} bytes`);
        debug(`    scriptData.stack[0] hex: ${bytesToHex(input.scriptData.stack[0]).slice(0, 40)}...`);
      }
      debug(`    scriptWitness exists: ${!!input.scriptWitness}`);
      debug(`    scriptWitness.stack length: ${input.scriptWitness?.stack?.length || 0}`);
    }
    debug('');

    const txHex = this.serializeTransaction(tx as Transaction);
    const txid = await this.calculateTxid(txHex);

    return {
      txHex,
      txid,
      fee: coinSelection.fee,
      change: coinSelection.change,
      size: txHex.length / 2,
      inputs: coinSelection.utxos,
      outputs: tx.outputs!,
    };
  }

  // ============================================================================
  // High-Level Wallet API
  // ============================================================================

  /**
   * Send VEIL to recipients (Smart Wrapper - Handles Everything Automatically)
   *
   * This is the main method wallet developers should use. It:
   * - Automatically fetches decoys from the network
   * - Checks UTXO health and warns about fragmentation
   * - Handles multi-transaction scenarios automatically
   * - Provides clear guidance on what to do
   *
   * @param spendKey - Spend private key
   * @param scanKey - Scan private key
   * @param recipients - Array of recipients (address, amount)
   * @param availableUTXOs - All available UTXOs
   * @returns Transaction result or multi-transaction plan
   */
  async send(
    spendKey: SecretKey,
    scanKey: SecretKey,
    recipients: Recipient[],
    availableUTXOs: UTXO[]
  ): Promise<{
    success: boolean;
    result?: BuildTransactionResult;
    multiTxRequired?: boolean;
    plan?: {
      transactions: Array<{
        inputUtxos: UTXO[];
        amount: bigint;
        estimatedFee: bigint;
      }>;
      totalFees: bigint;
    };
    warning?: string;
    error?: string;
    recommendation?: string;
  }> {
    // Ensure WASM is initialized
    if (!this.wasmInitialized) {
      await this.initialize();
    }

    // Analyze UTXO health first
    const analysis = this.analyzeUTXOs(availableUTXOs);

    // Calculate total send amount
    const totalAmount = recipients.reduce((sum, r) => sum + r.amount, 0n);

    // Check if we have enough funds
    if (totalAmount > analysis.totalValue) {
      return {
        success: false,
        error: `Insufficient funds: need ${satoshisToVeil(totalAmount)} VEIL, have ${satoshisToVeil(analysis.totalValue)} VEIL`,
      };
    }

    // Warn if fragmented
    let warning: string | undefined;
    if (analysis.needsConsolidation) {
      warning = `⚠️  You have ${analysis.totalUtxos} UTXOs. Consider consolidating first for better efficiency.`;
    } else if (analysis.isFragmented) {
      warning = `💡 You have ${analysis.totalUtxos} UTXOs. Consider consolidating when fees are low.`;
    }

    // Check if we can send in a single transaction
    const canSend = this.canSendInSingleTransaction(availableUTXOs, totalAmount);

    if (!canSend.canSend) {
      // Multiple transactions required
      const plan = this.planMultiTransaction(availableUTXOs, totalAmount);

      if (!plan.feasible) {
        return {
          success: false,
          error: plan.error,
          recommendation: 'Consider consolidating UTXOs first, then try sending again.',
        };
      }

      return {
        success: false,
        multiTxRequired: true,
        plan: {
          transactions: plan.transactions,
          totalFees: plan.totalFees,
        },
        warning,
        recommendation:
          `This send requires ${plan.transactions.length} separate transactions. ` +
          `Total fees: ${satoshisToVeil(plan.totalFees)} VEIL. ` +
          `Consider consolidating UTXOs first to reduce fees and complexity.`,
      };
    }

    // Single transaction is possible - fetch decoys and build
    try {
      debug(`[Send] Fetching decoys for ${canSend.requiredInputs} inputs...`);
      const decoys = await fetchDecoyOutputs(this.config.ringSize, canSend.requiredInputs);

      debug(`[Send] Building transaction...`);
      const result = await this.buildTransaction(
        spendKey,
        scanKey,
        recipients,
        availableUTXOs,
        decoys
      );

      return {
        success: true,
        result,
        warning,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        recommendation: 'Check your inputs and try again. If the error persists, try consolidating UTXOs first.',
      };
    }
  }

  /**
   * Consolidate UTXOs (Smart Wrapper)
   *
   * Automatically consolidates fragmented UTXOs to improve wallet efficiency.
   * Handles everything automatically - just call and it works!
   *
   * @param spendKey - Spend private key
   * @param scanKey - Scan private key
   * @param availableUTXOs - All available UTXOs to consolidate
   * @param maxInputsPerTx - Max inputs per transaction (default: 32)
   * @returns Consolidation results
   */
  async consolidate(
    spendKey: SecretKey,
    scanKey: SecretKey,
    availableUTXOs: UTXO[],
    maxInputsPerTx: number = MAX_ANON_INPUTS
  ): Promise<{
    success: boolean;
    transactions: BuildTransactionResult[];
    totalFees: bigint;
    before: { utxos: number; value: bigint };
    after: { utxos: number; value: bigint };
    error?: string;
  }> {
    // Ensure WASM is initialized
    if (!this.wasmInitialized) {
      await this.initialize();
    }

    if (availableUTXOs.length === 0) {
      return {
        success: false,
        error: 'No UTXOs to consolidate',
        transactions: [],
        totalFees: 0n,
        before: { utxos: 0, value: 0n },
        after: { utxos: 0, value: 0n },
      };
    }

    if (availableUTXOs.length === 1) {
      return {
        success: true,
        transactions: [],
        totalFees: 0n,
        before: { utxos: 1, value: availableUTXOs[0].amount },
        after: { utxos: 1, value: availableUTXOs[0].amount },
      };
    }

    const before = {
      utxos: availableUTXOs.length,
      value: availableUTXOs.reduce((sum, u) => sum + u.amount, 0n),
    };

    debug(`[Consolidate] Starting consolidation of ${before.utxos} UTXOs...`);
    debug(`[Consolidate] Total value: ${satoshisToVeil(before.value)} VEIL`);

    try {
      const transactions: BuildTransactionResult[] = [];
      let totalFees = 0n;
      let remainingUtxos = [...availableUTXOs];
      let round = 1;

      while (remainingUtxos.length > 1) {
        const batchSize = Math.min(maxInputsPerTx, remainingUtxos.length);
        const batch = remainingUtxos.splice(0, batchSize);

        debug(`[Consolidate] Round ${round}: Consolidating ${batch.length} UTXOs...`);

        // Fetch decoys
        const decoys = await fetchDecoyOutputs(this.config.ringSize, batch.length);

        // Build consolidation transaction
        const tx = await this.buildConsolidationTransaction(
          spendKey,
          scanKey,
          batch,
          decoys,
          batchSize
        );

        transactions.push(tx);
        totalFees += tx.fee;

        debug(`[Consolidate] Round ${round} complete. Fee: ${satoshisToVeil(tx.fee)} VEIL`);
        round++;
      }

      const after = {
        utxos: remainingUtxos.length + transactions.length,
        value: before.value - totalFees,
      };

      debug(`[Consolidate] ✅ Consolidation complete!`);
      debug(`[Consolidate] Before: ${before.utxos} UTXOs`);
      debug(`[Consolidate] After: ${after.utxos} UTXOs`);
      debug(`[Consolidate] Total fees: ${satoshisToVeil(totalFees)} VEIL`);
      debug(`[Consolidate] Saved: ${before.utxos - after.utxos} UTXOs`);

      return {
        success: true,
        transactions,
        totalFees,
        before,
        after,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        transactions: [],
        totalFees: 0n,
        before,
        after: before,
      };
    }
  }

  /**
   * Get wallet health status
   *
   * Quick health check for wallet developers to show in UI
   */
  getWalletHealth(utxos: UTXO[]): {
    status: 'healthy' | 'fragmented' | 'critical';
    utxoCount: number;
    totalValue: bigint;
    maxSendable: bigint;
    message: string;
    shouldConsolidate: boolean;
  } {
    const analysis = this.analyzeUTXOs(utxos);

    let status: 'healthy' | 'fragmented' | 'critical';
    let message: string;
    let shouldConsolidate: boolean;

    if (analysis.needsConsolidation) {
      status = 'critical';
      message = `⚠️  Critical: ${analysis.totalUtxos} UTXOs detected. You can only spend ${satoshisToVeil(analysis.maxSendableInSingleTx)} VEIL at a time.`;
      shouldConsolidate = true;
    } else if (analysis.isFragmented) {
      status = 'fragmented';
      message = `💡 ${analysis.totalUtxos} UTXOs. Consider consolidating for better efficiency.`;
      shouldConsolidate = true;
    } else {
      status = 'healthy';
      message = '✅ Wallet is healthy';
      shouldConsolidate = false;
    }

    return {
      status,
      utxoCount: analysis.totalUtxos,
      totalValue: analysis.totalValue,
      maxSendable: analysis.maxSendableInSingleTx,
      message,
      shouldConsolidate,
    };
  }

  /**
   * Validate transaction inputs
   */
  private validateTransactionInputs(
    recipients: Recipient[],
    utxos: UTXO[]
  ): void {
    // Check we have at least one recipient
    if (recipients.length === 0) {
      throw new Error('Transaction must have at least one recipient');
    }

    // Check all amounts are positive
    for (const recipient of recipients) {
      if (!isValidAmount(recipient.amount)) {
        throw new Error(`Invalid amount: ${recipient.amount}`);
      }
    }

    // Check we have UTXOs
    if (utxos.length === 0) {
      throw new Error('No UTXOs available for spending');
    }

    // Check all UTXOs have required fields
    for (const utxo of utxos) {
      if (!utxo.amount || !utxo.blind || !utxo.pubkey) {
        throw new Error('UTXO missing required fields (amount, blind, pubkey)');
      }
    }
  }

  /**
   * Select coins to spend
   *
   * Simple coin selection algorithm - can be improved
   */
  private selectCoins(
    utxos: UTXO[],
    targetAmount: bigint,
    feePerKb: number
  ): CoinSelectionResult {
    // IMPORTANT: Shuffle UTXOs randomly (matches Veil Core behavior)
    // See: veil/src/veil/ringct/anonwallet.cpp:6455
    // Veil Core uses: Shuffle(vCoins.begin(), vCoins.end(), FastRandomContext());
    // This improves privacy by making coin selection unpredictable
    const shuffled = shuffleArray([...utxos]);

    const selected: UTXO[] = [];
    let totalValue = 0n;

    // Estimate transaction size (rough approximation)
    const estimateSize = (numInputs: number, numOutputs: number): number => {
      // Base size + inputs + outputs + CT data
      return (
        100 + // Base transaction
        numInputs * (this.config.ringSize * 33 + 100) + // Inputs with ring signatures
        numOutputs * (33 + 73 + 50) // Outputs with commitments and range proofs
      );
    };

    // Select UTXOs until we have enough (up to MAX_ANON_INPUTS limit)
    for (const utxo of shuffled) {
      // Enforce consensus limit: maximum 32 inputs per transaction
      if (selected.length >= MAX_ANON_INPUTS) {
        // Check if we have enough with the inputs we've selected
        const txSize = estimateSize(selected.length, 2);
        const estimatedFee = BigInt(Math.ceil((txSize / 1000) * feePerKb));

        if (totalValue >= targetAmount + estimatedFee) {
          const change = totalValue - targetAmount - estimatedFee;
          return {
            utxos: selected,
            totalValue,
            fee: estimatedFee,
            change,
          };
        }

        // Hit the limit but don't have enough funds
        throw new Error(
          `Transaction would require more than ${MAX_ANON_INPUTS} inputs. ` +
          `Need ${targetAmount}, can only select ${totalValue} with ${MAX_ANON_INPUTS} inputs. ` +
          `Consider consolidating UTXOs or splitting into multiple transactions.`
        );
      }

      selected.push(utxo);
      totalValue += utxo.amount;

      // Estimate fee for current selection
      const txSize = estimateSize(selected.length, 2); // 2 outputs (recipient + change)
      const estimatedFee = BigInt(Math.ceil((txSize / 1000) * feePerKb));

      // Check if we have enough
      if (totalValue >= targetAmount + estimatedFee) {
        const change = totalValue - targetAmount - estimatedFee;

        return {
          utxos: selected,
          totalValue,
          fee: estimatedFee,
          change,
        };
      }
    }

    // Calculate what we actually need (including fee)
    const finalTxSize = estimateSize(selected.length, 2);
    const finalEstimatedFee = BigInt(Math.ceil((finalTxSize / 1000) * feePerKb));
    const totalNeeded = targetAmount + finalEstimatedFee;

    throw new Error(
      `Insufficient funds: need ${totalNeeded} (${targetAmount} + ${finalEstimatedFee} fee), have ${totalValue}`
    );
  }

  /**
   * Build change recipient (sends back to same address)
   */
  private buildChangeRecipient(
    spendKey: SecretKey,
    scanKey: SecretKey,
    changeAmount: bigint
  ): Recipient {
    // Generate public keys from spend/scan keys
    const spendPubkey = derivePublicKey(spendKey);
    const scanPubkey = derivePublicKey(scanKey);

    // Generate stealth address
    const stealthAddress = generateStealthAddress(scanPubkey, spendPubkey);

    return {
      address: stealthAddress,
      amount: changeAmount,
    };
  }

  /**
   * Build recipient output with ephemeral key
   */
  private async buildRecipientOutput(recipient: Recipient): Promise<any> {
    // Generate ephemeral keys for this recipient
    const ephemeralData = await generateEphemeralKeys(recipient.address);

    return {
      ...recipient,
      ephemeralPubKey: ephemeralData.ephemeralPubkey,
      ephemeralSecret: ephemeralData.ephemeralSecret,
      sharedSecret: ephemeralData.sharedSecret,
      destPubkey: ephemeralData.destPubkey,
    };
  }

  /**
   * Add CT data (commitments and range proofs) to outputs
   */
  private async addCTData(
    tx: Partial<Transaction>,
    recipients: any[],
    changeRecipient: any | null
  ): Promise<void> {
    tx.outputs = [];

    // Create fee OUTPUT_DATA (required by protocol)
    // C++ code: lightwallet.cpp:473 - uses PutVarInt (LEB128)
    if (tx.fee && tx.fee > 0n) {
      // Create OUTPUT_DATA with fee value (LEB128 encoded)
      const feeBytes = this.encodeLEB128(tx.fee);
      const vData = new Uint8Array(1 + feeBytes.length);
      vData[0] = DataOutputTypes.DO_FEE; // Fee marker (0x06)
      vData.set(feeBytes, 1);

      const feeOutput: TxOutputData = {
        type: OutputType.OUTPUT_DATA,
        address: '', // No address for fee output
        amount: 0n, // Fee is stored in vData, not amount
        vData,
      };

      tx.outputs!.push(feeOutput);

      // Also create commitment for fee (plain output) for Pedersen equation
      // This is required for MLSAG: sum(input_commits) = sum(output_commits) + fee_commit
      // CRITICAL: Fee commitment MUST use ZERO blind to match daemon verification!
      // See anon.cpp:38-45 - daemon uses memset(zeroBlind, 0, 32)
      const feeBlind = new Uint8Array(32);  // Zero blind for fee
      const feeCommitment = createCommitment(tx.fee, feeBlind);

      // Store fee commitment and blind for use in MLSAG
      (tx as any).feeCommitment = feeCommitment;
      (tx as any).feeBlind = feeBlind;

      debug(`[addCTData] Created fee OUTPUT_DATA and commitment for ${tx.fee} satoshis`);
      debug(`  Fee commitment: ${bytesToHex(feeCommitment).slice(0, 20)}...`);
    }

    // Process each recipient
    const allRecipients = changeRecipient ? [...recipients, changeRecipient] : recipients;

    // Generate random blinds for ALL outputs (including last)
    // Veil Core does NOT compute the last blind to balance - it uses random blinds for all
    // The blind balance is handled by prepare_mlsag, which computes blindSum as the secret key
    // for MLSAG row 1 (the commitment row)
    for (const recipient of allRecipients) {
      const blind = this.generateRandomBlind();
      const commitment = createCommitment(recipient.amount, blind);

      // Generate range proof nonce: SHA256(SHA256(ECDH_point))
      // This matches Veil Core's anonwallet.cpp:1602-1603:
      //   nonce = r.sEphem.ECDH(r.pkTo);  // Returns SHA256(compressed_point)
      //   CSHA256().Write(nonce.begin(), 32).Finalize(nonce.begin());  // Hash again!
      // So we need DOUBLE SHA256 for range proof nonce
      const wasm = getWasm();
      const ecdhResult = performEcdh(recipient.destPubkey, recipient.ephemeralSecret);  // SHA256(point)
      const nonce = wasm.hashSha256(ecdhResult);  // SHA256(SHA256(point)) - DOUBLE HASH!

      // Select optimal range proof parameters using Veil Core's algorithm
      // This matches Dart's: selectRangeProofParameters(nValue, min_value_ref, ct_exponent_ref, ct_bits)
      const params = selectRangeProofParameters(recipient.amount);

      // Validate parameters (safety check)
      if (!validateRangeProofParams(params)) {
        throw new Error(`Invalid range proof parameters for value ${recipient.amount}`);
      }

      debug(`[addCTData] Range proof params for ${recipient.amount}: exp=${params.exponent}, bits=${params.minBits}, min=${params.minValue}`);

      const rangeProof = generateRangeProof({
        commitment,
        value: recipient.amount,
        blind,
        nonce,
        message: new Uint8Array(0),
        minValue: params.minValue,
        exp: params.exponent,
        minBits: params.minBits,
      });

      // Build vData (ephemeral pubkey only - 33 bytes)
      // No prefix byte for RingCT outputs
      const vData = recipient.ephemeralPubKey;

      // Create RingCT output (Type 3)
      const output: TxOutputRingCT = {
        type: OutputType.OUTPUT_RINGCT,
        address: recipient.address,
        amount: recipient.amount,
        pk: recipient.destPubkey, // Destination public key
        commitment,
        vData,
        vRangeproof: rangeProof.proof,
        blind,
      };

      tx.outputs!.push(output);
    }
  }

  /**
   * Add inputs (real + decoys) to transaction
   */
  private async addInputs(
    tx: Partial<Transaction>,
    realUTXOs: UTXO[],
    dummyOutputs: any[],
    spendKey: SecretKey,
    scanKey: SecretKey
  ): Promise<void> {
    tx.inputs = [];

    debug(`[addInputs] Ring size: ${this.config.ringSize}`);
    debug(`[addInputs] Number of real UTXOs: ${realUTXOs.length}`);

    // CRITICAL: Each VIN must have a DIFFERENT random secret index
    // This matches Veil Core's behavior in lightwallet.cpp:1476

    // Track used decoys globally to prevent duplicates across inputs
    const usedDecoyIndices = new Set<number>();

    for (let i = 0; i < realUTXOs.length; i++) {
      const realUTXO = realUTXOs[i];

      // Generate a DIFFERENT random position for THIS input's real UTXO
      const secretIndex = Math.floor(Math.random() * this.config.ringSize);
      debug(`[addInputs] Input ${i}: Secret index = ${secretIndex}`);

      // Select decoys for this input (avoiding already-used decoys and all real UTXOs)
      const decoys = this.selectDecoys(
        dummyOutputs,
        this.config.ringSize - 1,
        usedDecoyIndices,
        realUTXOs
      );

      // Mark these decoys as used
      for (const decoy of decoys) {
        usedDecoyIndices.add(decoy.index);
      }

      debug(`[addInputs] Input ${i}: Real UTXO pubkey = ${bytesToHex(realUTXO.pubkey).slice(0, 20)}...`);

      // Build ring with real UTXO at the random position
      const ring = this.buildRingAtPosition(realUTXO, decoys, secretIndex);

      debug(`[addInputs] Input ${i}: Ring[${secretIndex}] = ${bytesToHex(ring[secretIndex]).slice(0, 20)}... (should match real UTXO)`);

      // Store the secret index on the UTXO
      (realUTXO as any).secretIndex = secretIndex;

      // Build prevout hash (encode nInputs + nRingSize in first 8 bytes)
      // C++ code: GetAnonInfo reads these as 4-byte little-endian uint32s
      // nInputs = number of UTXOs being spent in THIS input's MLSAG (always 1 for us)
      // nRingSize = number of ring members (decoys + real)
      const prevoutHash = new Uint8Array(32);

      // nInputs at bytes 0-3 (uint32 LE) - always 1 per VIN
      const nInputs = 1;
      prevoutHash[0] = nInputs & 0xff;
      prevoutHash[1] = (nInputs >> 8) & 0xff;
      prevoutHash[2] = (nInputs >> 16) & 0xff;
      prevoutHash[3] = (nInputs >> 24) & 0xff;

      // nRingSize at bytes 4-7 (uint32 LE)
      prevoutHash[4] = this.config.ringSize & 0xff;
      prevoutHash[5] = (this.config.ringSize >> 8) & 0xff;
      prevoutHash[6] = (this.config.ringSize >> 16) & 0xff;
      prevoutHash[7] = (this.config.ringSize >> 24) & 0xff;

      // Store ring member indices for witness data
      const ringIndices: number[] = new Array(this.config.ringSize);
      for (let col = 0; col < this.config.ringSize; col++) {
        if (col === secretIndex) {
          // Real UTXO index
          if ((realUTXO as any).ringctIndex === undefined) {
            throw new Error(`Real UTXO missing ringctIndex (blockchain output index)`);
          }
          ringIndices[col] = (realUTXO as any).ringctIndex;
          debug(`[addInputs] Real UTXO at ring position ${col}: index=${ringIndices[col]}`);
        } else {
          // Decoy index
          const decoyIdx = col < secretIndex ? col : col - 1;
          if (decoys[decoyIdx].index === undefined) {
            throw new Error(`Decoy ${decoyIdx} missing index (blockchain output index)`);
          }
          ringIndices[col] = decoys[decoyIdx].index;
          debug(`[addInputs] Decoy ${decoyIdx} at ring position ${col}: index=${ringIndices[col]}, pubkey=${bytesToHex(decoys[decoyIdx].pubkey).slice(0, 16)}...`);
        }
      }

      debug(`[addInputs] Ring indices for input ${i}:`, ringIndices);

      tx.inputs!.push({
        ring,
        keyImage: new Uint8Array(33), // Will be filled in insertKeyImages
        secretIndex,
        secretKey: spendKey,
        prevout: {
          hash: prevoutHash,
          n: ANON_MARKER, // 0xffffffa0 for RingCT inputs
        },
        scriptSig: new Uint8Array(0), // Empty for RingCT
        nSequence: 0xffffffff,
        scriptData: {
          stack: [], // Will be filled in insertKeyImages
        },
        // Store ring indices for later witness encoding
        ringIndices,
      });
    }
  }

  /**
   * Select decoy outputs for ring
   * For multi-input transactions, ensures:
   * - No decoy is reused across inputs
   * - No real UTXO being spent appears as a decoy in any ring
   */
  private selectDecoys(
    dummyOutputs: any[],
    count: number,
    usedDecoyIndices: Set<number>,
    realUTXOs: UTXO[]
  ): any[] {
    // Create a set of all real UTXO pubkeys for fast lookup
    const realUTXOPubkeys = new Set<string>();
    for (const utxo of realUTXOs) {
      realUTXOPubkeys.add(bytesToHex(utxo.pubkey));
    }

    // Filter out:
    // 1. ALL real UTXOs being spent in this transaction
    // 2. Already-used decoys (for multi-input transactions)
    const availableDecoys = dummyOutputs.filter(decoy => {
      // Exclude any real UTXO being spent
      if (realUTXOPubkeys.has(decoy.pubkey)) {
        return false;
      }
      // Exclude already-used decoys
      if (usedDecoyIndices.has(decoy.index)) {
        return false;
      }
      return true;
    });

    if (availableDecoys.length < count) {
      throw new Error(
        `Not enough decoy outputs available. Need ${count}, have ${availableDecoys.length} (after filtering ${realUTXOPubkeys.size} real UTXOs and ${usedDecoyIndices.size} already-used decoys)`
      );
    }

    // Randomly select decoys
    return randomSample(availableDecoys, count);
  }

  /**
   * Build ring of public keys with real UTXO at specific position
   *
   * Each VIN (input) has its own independent ring with the real UTXO at a
   * randomly selected position. Different VINs will have different positions.
   * This matches Veil Core's implementation.
   *
   * @param realUTXO - The real UTXO to spend
   * @param decoys - Array of decoy outputs
   * @param position - Exact position (0 to ringSize-1) where real UTXO must be placed
   */
  private buildRingAtPosition(realUTXO: UTXO, decoys: any[], position: number): PublicKey[] {
    const ringSize = this.config.ringSize;
    const ring: PublicKey[] = [];

    // CRITICAL: Do NOT shuffle decoys!
    // The decoys must be in the same order as ringIndices that we encode in the witness.
    // If we shuffle here, ring[col] won't match ringIndices[col], causing MLSAG verification to fail.
    // Security: The real UTXO is already at a random position, so no need to shuffle decoys.

    // Build ring with real UTXO at the specified position
    let decoyIndex = 0;
    for (let i = 0; i < ringSize; i++) {
      if (i === position) {
        // Place real UTXO at the secret position
        ring.push(realUTXO.pubkey);
      } else {
        // Place decoy at this position (in original order!)
        ring.push(decoys[decoyIndex].pubkey);
        decoyIndex++;
      }
    }

    return ring;
  }

  /**
   * Insert key images for spent outputs
   * CRITICAL: For stealth addresses, key images must be computed from destination keys,
   * not from the raw spend key!
   */
  private async insertKeyImages(
    tx: Partial<Transaction>,
    utxos: UTXO[],
    spendKey: SecretKey,
    scanKey: SecretKey
  ): Promise<void> {
    for (let i = 0; i < tx.inputs!.length; i++) {
      const utxo = utxos[i];

      // Derive destination secret key for this UTXO (stealth address math)
      if (!(utxo as any).ephemeralPubkey) {
        throw new Error(`UTXO ${i} missing ephemeralPubkey for key image generation`);
      }

      const destinationKey = this.deriveDestinationKey(
        spendKey,
        scanKey,
        (utxo as any).ephemeralPubkey
      );

      // Generate key image from destination key, not spend key
      const keyImage = generateKeyImage(utxo.pubkey, destinationKey);

      // Store key image in both places
      tx.inputs![i].keyImage = keyImage;

      // Add key image to scriptData.stack (Veil Core format)
      if (!tx.inputs![i].scriptData) {
        tx.inputs![i].scriptData = { stack: [] };
      }
      tx.inputs![i].scriptData!.stack.push(keyImage);
    }
  }

  /**
   * Derive destination secret key for a stealth address UTXO
   *
   * Formula: destination_sk = spend_sk + H(ECDH(scan_sk, ephemeral_pk))
   *
   * This matches the Dart implementation:
   * LightwalletTransactionBuilder.getDestinationKeyForOutput
   */
  private deriveDestinationKey(
    spendKey: SecretKey,
    scanKey: SecretKey,
    ephemeralPubkey: PublicKey
  ): SecretKey {
    // Compute shared point: Q = ephemeral_pk * scan_sk (scalar multiplication)
    const sharedPoint = pointMultiply(ephemeralPubkey, scanKey);

    // Hash the point: sShared = H(Q)
    const wasm = getWasm();
    const sShared = wasm.hashSha256(sharedPoint);

    // Add to spend key: destination_sk = spend_sk + sShared
    const destinationKey = privateAdd(spendKey, sShared);

    return destinationKey;
  }

  /**
   * Generate MLSAG signature for a SINGLE input (VIN)
   * This handles the simple case where txNew.vin.length == 1
   */
  private async generateSingleInputMLSAG(
    tx: Partial<Transaction>,
    inputIndex: number,
    utxo: UTXO,
    dummyOutputs: any[],
    spendKey: SecretKey,
    scanKey: SecretKey
  ): Promise<void> {
    const input = tx.inputs![inputIndex];
    const ringSize = input.ring.length;
    const nSigInputs = 1;  // One UTXO per VIN in our implementation
    const nRows = nSigInputs + 1;  // 1 input row + 1 commitment row

    debug(`\n[generateSingleInputMLSAG] Input ${inputIndex}:`);
    debug(`  Ring size: ${ringSize}`);
    debug(`  nRows: ${nRows} (${nSigInputs} inputs + 1 commitment)`);
    debug(`  Secret index: ${input.secretIndex}`);
    debug(`  Real UTXO pubkey: ${bytesToHex(utxo.pubkey).slice(0, 20)}...`);

    // Log the ring
    debug(`  Ring contents:`);
    for (let i = 0; i < input.ring.length; i++) {
      const isReal = bytesToHex(input.ring[i]) === bytesToHex(utxo.pubkey);
      debug(`    [${i}]: ${bytesToHex(input.ring[i]).slice(0, 20)}... ${isReal ? '<-- REAL UTXO' : ''}`);
    }

    // 1. Build M matrix (nRows x nCols)
    const vm = new Uint8Array(ringSize * nRows * 33);

    // Fill first row with ring pubkeys (ROW-MAJOR order, like C++)
    // Formula: offset = (col + row * ringSize) * 33
    debug(`\n  === MATRIX M ROW 0: PUBLIC KEYS ===`);
    const inputRingIndices = (input as any).ringIndices;
    for (let col = 0; col < ringSize; col++) {
      const pk = input.ring[col];
      const row = 0;  // First row is pubkeys
      const offset = (col + row * ringSize) * 33;
      vm.set(pk, offset);

      // Log the mapping: matrix position -> public key -> blockchain index
      debug(`    M[col=${col}][row=0] = ${bytesToHex(pk).slice(0, 40)}... (index: ${inputRingIndices ? inputRingIndices[col] : 'unknown'})`);
    }
    debug(`  ====================================\n`);

    // 2. Collect input commitments from ring members
    const vpInCommits: Uint8Array[] = new Array(ringSize);

    for (let col = 0; col < ringSize; col++) {
      const pubkey = input.ring[col];
      const pubkeyHex = bytesToHex(pubkey);

      // Check if this is the real UTXO
      if (bytesToHex(utxo.pubkey) === pubkeyHex) {
        vpInCommits[col] = utxo.commitment;
        debug(`  Ring[${col}] = REAL UTXO (commitment: ${bytesToHex(utxo.commitment).slice(0, 20)}..., prefix: 0x${utxo.commitment[0].toString(16).padStart(2, '0')})`);
        continue;
      }

      // Otherwise, look up in dummy outputs
      const decoy = dummyOutputs.find(d => bytesToHex(d.pubkey) === pubkeyHex);
      if (decoy && decoy.commitment) {
        vpInCommits[col] = decoy.commitment;
        debug(`  Ring[${col}] = DECOY (commitment prefix: 0x${decoy.commitment[0].toString(16).padStart(2, '0')})`);
      } else {
        throw new Error(`Missing commitment for ring member at position ${col}`);
      }
    }

    // 3. Collect output commitments
    // CRITICAL: Must match daemon verification (anon.cpp:96-104)
    // Daemon adds plain commitment FIRST, then RingCT commitments
    // vpOutCommits = [fee_commit, ringct1, ringct2]
    const vpOutCommits: Uint8Array[] = [];

    // Add fee commitment FIRST (if present)
    // This MUST be added to match daemon verification
    if ((tx as any).feeCommitment) {
      vpOutCommits.push((tx as any).feeCommitment);
      debug(`  Including fee commitment in vpOutCommits (prefix: 0x${((tx as any).feeCommitment[0]).toString(16).padStart(2, '0')})`);
    }

    // Then add RingCT/CT output commitments
    for (const output of tx.outputs!) {
      if ('commitment' in output && output.commitment) {
        vpOutCommits.push(output.commitment);
        debug(`  Including RingCT output commitment in vpOutCommits (prefix: 0x${output.commitment[0].toString(16).padStart(2, '0')})`);
      }
    }

    // 4. Collect blinds: [input_blind, fee_blind, output_blinds...]
    // CRITICAL: Must match the order of vpOutCommits
    // vpOutCommits = [fee_commit, ringct1, ringct2]
    // vpBlinds = [input, fee_blind, ringct1_blind, ringct2_blind]
    const vpBlinds: Uint8Array[] = [utxo.blind];

    // Add fee blind (zero) if fee commitment is present
    if ((tx as any).feeBlind) {
      vpBlinds.push((tx as any).feeBlind);  // This is already zeros
      debug(`  Including fee blind (zeros) in vpBlinds`);
    }

    // Add output blinds (only for RingCT outputs)
    for (const output of tx.outputs!) {
      if (output.blind) {
        vpBlinds.push(output.blind);
      }
    }

    debug(`  Input commitment count: ${vpInCommits.length}`);
    debug(`  Output commitment count: ${vpOutCommits.length}`);
    debug(`  Blind count: ${vpBlinds.length} (1 input + ${vpBlinds.length - 1} outputs)`);

    // Debug: Log vpInCommits
    debug(`  vpInCommits:`);
    for (let i = 0; i < vpInCommits.length; i++) {
      const isZero = vpInCommits[i].every(b => b === 0);
      debug(`    [${i}]: ${isZero ? 'ZERO!' : bytesToHex(vpInCommits[i])}`);
    }

    // Debug: Log vpOutCommits
    debug(`  vpOutCommits:`);
    for (let i = 0; i < vpOutCommits.length; i++) {
      debug(`    [${i}]: ${bytesToHex(vpOutCommits[i])}`);
    }

    // Debug: Log M matrix before prepareMlsag (ROW-MAJOR order)
    debug(`  M matrix before prepareMlsag:`);
    for (let col = 0; col < ringSize; col++) {
      for (let row = 0; row < nRows; row++) {
        const offset = (col + row * ringSize) * 33;
        const point = vm.slice(offset, offset + 33);
        const isZero = point.every(b => b === 0);
        debug(`    [col${col}][row${row}] @ offset ${offset}: ${isZero ? 'ZERO!' : bytesToHex(point).slice(0, 20) + '...'}`);
      }
    }

    // 5. Prepare MLSAG
    debug(`\n=== PREPARE_MLSAG CALL (Real Transaction) ===`);
    debug(`m_initial: ${bytesToHex(vm)}`);
    debug(`nOuts: ${vpOutCommits.length}`);
    debug(`nBlinded: ${vpOutCommits.length}`);
    debug(`vpInCommitsLen: ${vpInCommits.length}`);
    debug(`vpBlindsLen: ${vpBlinds.length}`);
    debug(`nCols: ${ringSize}`);
    debug(`nRows: ${nRows}`);
    debugGroup(`vpInCommits (${vpInCommits.length} items)`, () => {
      vpInCommits.forEach((c, i) => debug(`  [${i}]: ${bytesToHex(c)}`));
    });
    debugGroup(`vpOutCommits (${vpOutCommits.length} items)`, () => {
      vpOutCommits.forEach((c, i) => debug(`  [${i}]: ${bytesToHex(c)}`));
    });
    debugGroup(`vpBlinds (${vpBlinds.length} items)`, () => {
      vpBlinds.forEach((b, i) => debug(`  [${i}]: ${bytesToHex(b)}`));
    });
    debug(`==============================================\n`);

    // CRITICAL: Match daemon verification (anon.cpp:154-156)
    // Daemon passes vpOutCommits.size() for BOTH nOuts and nBlinded
    // vpOutCommits = [fee_commit, ringct1, ringct2]
    // So nOuts = nBlinded = 3
    const prepared = prepareMlsag({
      m: vm,
      nOuts: vpOutCommits.length,     // All commits (fee + RingCT)
      nBlinded: vpOutCommits.length,  // Same (fee commit explicitly included)
      vpInCommitsLen: vpInCommits.length,
      vpBlindsLen: vpBlinds.length,
      nCols: ringSize,
      nRows,
      vpInCommits,
      vpOutCommits,  // [fee_commit, ringct1, ringct2]
      vpBlinds,      // [input_blind, output1_blind, output2_blind] - NO fee blind
    });

    debug(`\n=== PREPARE_MLSAG RESULT (Real Transaction) ===`);
    debug(`m_updated: ${bytesToHex(prepared.m)}`);
    debug(`sk: ${bytesToHex(prepared.sk)}`);
    debug(`===============================================\n`);

    debug(`  Blind sum: ${bytesToHex(prepared.sk).slice(0, 20)}...`);

    // Debug: Log M matrix AFTER prepareMlsag (ROW-MAJOR order)
    debug(`  M matrix AFTER prepareMlsag:`);
    for (let col = 0; col < ringSize; col++) {
      for (let row = 0; row < nRows; row++) {
        const offset = (col + row * ringSize) * 33;
        const point = prepared.m.slice(offset, offset + 33);
        const isZero = point.every(b => b === 0);
        debug(`    [col${col}][row${row}] @ offset ${offset}: ${isZero ? 'ZERO!' : bytesToHex(point).slice(0, 20) + '...'}`);
      }
    }

    // 6. Build secret key array
    const destinationKey = this.deriveDestinationKey(
      spendKey,
      scanKey,
      (utxo as any).ephemeralPubkey
    );

    // Verify destination key
    const derivedPubkey = derivePublicKey(destinationKey);
    if (bytesToHex(derivedPubkey) !== bytesToHex(utxo.pubkey)) {
      throw new Error(`Destination key mismatch for input ${inputIndex}`);
    }

    const vpsk = [
      destinationKey,  // Input secret key
      prepared.sk,     // Blind sum
    ];

    // 7. Calculate transaction hash
    const txHash = this.calculateTransactionHash(tx);
    debug(`  Transaction hash: ${bytesToHex(txHash).slice(0, 20)}...`);

    // 8. Generate MLSAG signature
    const nonce = getRandomBytes(32);
    const secretIndex = input.secretIndex;

    debug(`  Secret index: ${secretIndex}`);
    debug(`  Generating MLSAG...`);
    debug(`  Number of outputs in tx: ${tx.outputs!.length}`);
    debug(`  Output types: ${tx.outputs!.map(o => o.type).join(', ')}`);

    debug(`\n=== GENERATE_MLSAG CALL (Real Transaction) ===`);
    debug(`nonce: ${bytesToHex(nonce)}`);
    debug(`preimage: ${bytesToHex(txHash)}`);
    debug(`nCols: ${ringSize}`);
    debug(`nRows: ${nRows}`);
    debug(`index: ${secretIndex}`);
    debugGroup(`secretKeys (${vpsk.length} items)`, () => {
      vpsk.forEach((sk, i) => debug(`  sk[${i}]: ${bytesToHex(sk)}`));
    });
    debug(`publicKeys: ${bytesToHex(prepared.m)}`);
    debug(`==============================================\n`);

    const mlsagResult = generateMlsag({
      nonce,
      preimage: txHash,
      nCols: ringSize,
      nRows,
      index: secretIndex,
      secretKeys: vpsk,
      publicKeys: prepared.m,
    });

    debug(`\n=== GENERATE_MLSAG RESULT (Real Transaction) ===`);
    debug(`key_images: ${bytesToHex(mlsagResult.keyImages)}`);
    debug(`pc: ${bytesToHex(mlsagResult.pc)}`);
    debug(`ps: ${bytesToHex(mlsagResult.ps)}`);
    debug(`================================================\n`);

    debug(`  ✅ MLSAG generated`);
    debug(`    Key images: ${bytesToHex(mlsagResult.keyImages).slice(0, 40)}...`);
    debug(`    pc length: ${mlsagResult.pc.length} bytes`);
    debug(`    ps length: ${mlsagResult.ps.length} bytes`);

    // 9. Verify MLSAG
    debug(`  Verifying MLSAG...`);
    debug(`    preimage: ${bytesToHex(txHash).slice(0, 40)}... (${txHash.length} bytes)`);
    debug(`    publicKeys: ${prepared.m.length} bytes (expected: ${ringSize * nRows * 33})`);
    debug(`    keyImages: ${mlsagResult.keyImages.length} bytes (expected: ${(nRows - 1) * 33})`);
    debug(`    pc: ${mlsagResult.pc.length} bytes (expected: 32)`);
    debug(`    ps: ${mlsagResult.ps.length} bytes (expected: ${ringSize * nRows * 32})`);
    debug(`    nCols: ${ringSize}, nRows: ${nRows}`);

    const isValid = verifyMlsag({
      preimage: txHash,
      nCols: ringSize,
      nRows,
      publicKeys: prepared.m,
      keyImages: mlsagResult.keyImages,
      pc: mlsagResult.pc,
      ps: mlsagResult.ps,
    });

    if (!isValid) {
      throw new Error(`MLSAG verification failed for input ${inputIndex}`);
    }

    debug(`  ✅ MLSAG verified`);

    // 10. Encode witness data
    // scriptWitness.stack[0] = Ring member indices (varint encoded)
    // scriptWitness.stack[1] = MLSAG signature (pc + ps combined)

    // Encode ring indices as varints
    const ringIndices = (input as any).ringIndices;
    if (!ringIndices) {
      throw new Error('Ring indices not found on input');
    }

    debug(`  Encoding ${ringIndices.length} ring member indices as varints...`);
    const encodedIndices = this.encodeRingIndices(ringIndices);
    debug(`  Encoded indices: ${encodedIndices.length} bytes`);

    // Combine pc + ps into single buffer (vDL format)
    // vDL = [pc (32 bytes)][ps (ringSize * nRows * 32 bytes)]
    const vDL = new Uint8Array(mlsagResult.pc.length + mlsagResult.ps.length);
    vDL.set(mlsagResult.pc, 0);
    vDL.set(mlsagResult.ps, mlsagResult.pc.length);
    debug(`  Combined MLSAG signature (vDL): ${vDL.length} bytes`);

    // Store in witness
    input.scriptWitness = {
      stack: [encodedIndices, vDL],
    };
  }

  /**
   * Encode ring member indices using LEB128
   * Used for scriptWitness.stack[0]
   *
   * Matches Veil C++: lightwallet.cpp:1536
   *   PutVarInt(vPubkeyMatrixIndices, vMI[l][k][i]);
   */
  private encodeRingIndices(indices: number[]): Uint8Array {
    debug(`\n  === ENCODING RING INDICES FOR TRANSACTION ===`);
    const parts: Uint8Array[] = [];

    for (let i = 0; i < indices.length; i++) {
      const index = indices[i];
      const encoded = this.encodeLEB128(BigInt(index));
      parts.push(encoded);
      debug(`    Ring[${i}]: index=${index} -> LEB128: ${bytesToHex(encoded)}`);
    }

    const result = concatBytes(...parts);
    debug(`  Total encoded size: ${result.length} bytes`);
    debug(`  Full encoded data: ${bytesToHex(result)}`);
    debug(`  ============================================\n`);
    return result;
  }

  /**
   * Generate MLSAG signatures for transaction
   * Creates ONE MLSAG PER INPUT (VIN), not one for all inputs!
   */
  private async generateMLSAGSignatures(
    tx: Partial<Transaction>,
    utxos: UTXO[],
    dummyOutputs: any[],
    spendKey: SecretKey,
    scanKey: SecretKey
  ): Promise<void> {
    const numInputs = tx.inputs!.length;

    debug(`\n[generateMLSAGSignatures] Generating ${numInputs} MLSAG signature(s)...`);

    if (numInputs === 1) {
      // Single input case: pass all output commitments
      debug(`[generateMLSAGSignatures] Single input - using all output commitments`);
      await this.generateSingleInputMLSAG(tx, 0, utxos[0], dummyOutputs, spendKey, scanKey);
    } else {
      // Multi-input case: split commitments across inputs
      debug(`[generateMLSAGSignatures] Multi-input - splitting output commitments`);
      await this.generateMultiInputMLSAG(tx, utxos, dummyOutputs, spendKey, scanKey);
    }

    // CRITICAL: Collect witness data from all inputs into tx.witness
    // The serializer expects tx.witness.scriptWitness, not input.scriptWitness
    tx.witness = {
      scriptWitness: tx.inputs!.map(input => {
        if (!input.scriptWitness) {
          throw new Error('Input missing scriptWitness after MLSAG generation');
        }
        return input.scriptWitness;
      }),
    };

    debug(`[generateMLSAGSignatures] ✅ All MLSAG signatures generated and verified\n`);
  }

  /**
   * Generate MLSAG signatures for multi-input transaction with split commitments
   *
   * In multi-input RingCT, each input creates its own "split commitment" representing
   * the value contributed by that input. The Pedersen commitment balance is:
   *   sum(split_commits) = sum(output_commits) + fee_commit
   *
   * Each input's MLSAG only sees its own split commitment (nOuts=1, nBlinded=1).
   * The last input's blind is calculated to balance the equation.
   *
   * This matches Veil C++ implementation in anonwallet.cpp
   */
  private async generateMultiInputMLSAG(
    tx: Partial<Transaction>,
    utxos: UTXO[],
    dummyOutputs: any[],
    spendKey: SecretKey,
    scanKey: SecretKey
  ): Promise<void> {
    const numInputs = tx.inputs!.length;

    debug(`\n[generateMultiInputMLSAG] Processing ${numInputs} inputs`);
    debug(`  Creating split commitments (one per input)`);

    // Collect all output blinds (for balancing equation)
    const outputBlinds: Uint8Array[] = [];

    // Add fee blind if present
    if ((tx as any).feeBlind) {
      outputBlinds.push((tx as any).feeBlind);
    }

    // Add output blinds
    for (const output of tx.outputs!) {
      if (output.blind) {
        outputBlinds.push(output.blind);
      }
    }

    debug(`  Total output blinds for balancing: ${outputBlinds.length}`);

    // Create split commitment blinding factors
    const splitCommitBlinds: Uint8Array[] = [];

    for (let i = 0; i < numInputs; i++) {
      if (i === numInputs - 1) {
        // Last input: calculate blind to balance the equation
        // blind_last = sum(output_blinds + previous_split_blinds)
        const allBlindsForSum = [...outputBlinds, ...splitCommitBlinds];
        const balancingBlind = sumBlinds(allBlindsForSum, outputBlinds.length);
        splitCommitBlinds.push(balancingBlind);
        debug(`  Input ${i}: Calculated balancing blind`);
      } else {
        // Other inputs: generate random blind
        const randomBlind = this.generateRandomBlind();
        splitCommitBlinds.push(randomBlind);
        debug(`  Input ${i}: Generated random blind`);
      }
    }

    // Generate MLSAG for each input with its split commitment
    for (let i = 0; i < numInputs; i++) {
      // Calculate this input's total value
      const inputValue = utxos[i].amount;

      debug(`\n  Input ${i}:`);
      debug(`    Value: ${satoshisToVeil(inputValue)} VEIL`);

      await this.generateMultiInputMLSAGForInput(
        tx,
        i,
        utxos[i],
        dummyOutputs,
        spendKey,
        scanKey,
        inputValue,
        splitCommitBlinds[i]
      );
    }

    debug(`\n[generateMultiInputMLSAG] ✅ All ${numInputs} MLSAG signatures generated`);
  }

  /**
   * Generate MLSAG for a single input in a multi-input transaction
   * Uses a split commitment (commitment to this input's value only)
   */
  private async generateMultiInputMLSAGForInput(
    tx: Partial<Transaction>,
    inputIndex: number,
    utxo: UTXO,
    dummyOutputs: any[],
    spendKey: SecretKey,
    scanKey: SecretKey,
    inputValue: bigint,
    splitCommitBlind: Uint8Array
  ): Promise<void> {
    const input = tx.inputs![inputIndex];
    const ringSize = input.ring.length;
    const nSigInputs = 1;
    const nRows = nSigInputs + 1;

    debug(`    [Input ${inputIndex}] Generating MLSAG with split commitment:`);
    debug(`      Ring size: ${ringSize}`);
    debug(`      nRows: ${nRows}`);
    debug(`      Secret index: ${input.secretIndex}`);

    // 1. Create split commitment for this input's value
    const splitCommitment = createCommitment(inputValue, splitCommitBlind);
    debug(`      Split commitment: ${bytesToHex(splitCommitment).slice(0, 20)}...`);

    // 2. Build M matrix
    const vm = new Uint8Array(ringSize * nRows * 33);

    // Fill first row with ring pubkeys
    for (let col = 0; col < ringSize; col++) {
      const pk = input.ring[col];
      const row = 0;
      const offset = (col + row * ringSize) * 33;
      vm.set(pk, offset);
    }

    // 3. Collect input commitments from ring members
    const vpInCommits: Uint8Array[] = new Array(ringSize);

    for (let col = 0; col < ringSize; col++) {
      const pubkey = input.ring[col];
      const pubkeyHex = bytesToHex(pubkey);

      if (bytesToHex(utxo.pubkey) === pubkeyHex) {
        vpInCommits[col] = utxo.commitment;
        continue;
      }

      const decoy = dummyOutputs.find(d => bytesToHex(d.pubkey) === pubkeyHex);
      if (decoy && decoy.commitment) {
        vpInCommits[col] = decoy.commitment;
      } else {
        throw new Error(`Missing commitment for ring member at position ${col}`);
      }
    }

    // 4. CRITICAL: For multi-input, each MLSAG only sees its split commitment
    // nOuts = 1, nBlinded = 1, vpOutCommits = [splitCommitment]
    const vpOutCommits = [splitCommitment];

    // 5. Blinds: [input_blind, split_commit_blind]
    const vpBlinds: Uint8Array[] = [utxo.blind, splitCommitBlind];

    debug(`      Input commitment count: ${vpInCommits.length}`);
    debug(`      Output commitment count: ${vpOutCommits.length} (split commit only)`);
    debug(`      Blind count: ${vpBlinds.length}`);

    // 6. Prepare MLSAG with split commitment
    const prepared = prepareMlsag({
      m: vm,
      nOuts: 1,  // Only the split commitment
      nBlinded: 1,  // Only the split commitment
      vpInCommitsLen: vpInCommits.length,
      vpBlindsLen: vpBlinds.length,
      nCols: ringSize,
      nRows,
      vpInCommits,
      vpOutCommits,
      vpBlinds,
    });

    // 7. Build secret key array
    const destinationKey = this.deriveDestinationKey(
      spendKey,
      scanKey,
      (utxo as any).ephemeralPubkey
    );

    const vpsk = [
      destinationKey,
      prepared.sk,
    ];

    // 8. Calculate transaction hash
    const txHash = this.calculateTransactionHash(tx);

    // 9. Generate MLSAG signature
    const nonce = getRandomBytes(32);
    const secretIndex = input.secretIndex;

    debug(`      Generating MLSAG with secret index ${secretIndex}...`);

    const mlsagResult = generateMlsag({
      nonce,
      preimage: txHash,
      nCols: ringSize,
      nRows,
      index: secretIndex,
      secretKeys: vpsk,
      publicKeys: prepared.m,
    });

    // 10. Verify MLSAG
    const isValid = verifyMlsag({
      preimage: txHash,
      nCols: ringSize,
      nRows,
      publicKeys: prepared.m,
      keyImages: mlsagResult.keyImages,
      pc: mlsagResult.pc,
      ps: mlsagResult.ps,
    });

    if (!isValid) {
      throw new Error(`MLSAG verification failed for input ${inputIndex}`);
    }

    debug(`      ✅ MLSAG verified for input ${inputIndex}`);

    // 11. Key images already set by insertKeyImages() - don't overwrite!
    // The MLSAG result keyImages should match what's already in scriptData.stack[0]
    debug(`      Key images from MLSAG: ${bytesToHex(mlsagResult.keyImages).slice(0, 40)}...`);
    debug(`      Key images already in scriptData from insertKeyImages()`);

    // 12. Encode witness data
    const ringIndices = (input as any).ringIndices;
    if (!ringIndices) {
      throw new Error('Ring indices not found on input');
    }

    const encodedIndices = this.encodeRingIndices(ringIndices);

    // Combine pc + ps + split commitment (33 bytes extra for multi-input)
    const vDL = new Uint8Array(mlsagResult.pc.length + mlsagResult.ps.length + 33);
    vDL.set(mlsagResult.pc, 0);
    vDL.set(mlsagResult.ps, mlsagResult.pc.length);
    vDL.set(splitCommitment, mlsagResult.pc.length + mlsagResult.ps.length);

    debug(`      Witness size: ${vDL.length} bytes (includes 33-byte split commitment)`);

    input.scriptWitness = {
      stack: [encodedIndices, vDL],
    };
  }

  /**
   * Encode a BigInt as a variable-length integer (varint)
   * Bitcoin-style varint encoding (for lengths/counts)
   *
   * NOT used for ring indices or fees - those use LEB128!
   */
  private encodeVarInt(value: bigint): Uint8Array {
    if (value < 0n) {
      throw new Error('Cannot encode negative value as varint');
    }

    // varint encoding:
    // < 0xfd: 1 byte
    // < 0x10000: 0xfd + 2 bytes (LE)
    // < 0x100000000: 0xfe + 4 bytes (LE)
    // >= 0x100000000: 0xff + 8 bytes (LE)

    if (value < 0xfdn) {
      return new Uint8Array([Number(value)]);
    } else if (value < 0x10000n) {
      const buf = new Uint8Array(3);
      buf[0] = 0xfd;
      buf[1] = Number(value & 0xffn);
      buf[2] = Number((value >> 8n) & 0xffn);
      return buf;
    } else if (value < 0x100000000n) {
      const buf = new Uint8Array(5);
      buf[0] = 0xfe;
      buf[1] = Number(value & 0xffn);
      buf[2] = Number((value >> 8n) & 0xffn);
      buf[3] = Number((value >> 16n) & 0xffn);
      buf[4] = Number((value >> 24n) & 0xffn);
      return buf;
    } else {
      const buf = new Uint8Array(9);
      buf[0] = 0xff;
      for (let i = 0; i < 8; i++) {
        buf[i + 1] = Number((value >> BigInt(i * 8)) & 0xffn);
      }
      return buf;
    }
  }

  /**
   * Encode a BigInt using LEB128 (Little Endian Base 128)
   *
   * This matches Veil's PutVarInt in serialize.h:453
   * Used for: ring member indices, fee values
   *
   * Encoding: 7-bit chunks with continuation bit (0x80)
   * Example: 253687 → [0xb7, 0xdf, 0x03]
   */
  private encodeLEB128(value: bigint): Uint8Array {
    if (value < 0n) {
      throw new Error('Cannot encode negative value as LEB128');
    }

    const bytes: number[] = [];
    let remaining = value;

    // Encode 7-bit chunks with continuation bit
    while (remaining > 0x7Fn) {
      bytes.push(Number(remaining & 0x7Fn) | 0x80);  // Set continuation bit
      remaining >>= 7n;
    }

    // Final byte (no continuation bit)
    bytes.push(Number(remaining & 0x7Fn));

    return new Uint8Array(bytes);
  }

  /**
   * Calculate transaction hash for signing
   *
   * This hashes all outputs to create the preimage for MLSAG
   *
   * Matches Dart implementation: CMutableTransaction.getOutputsHash()
   * Uses iterative double-SHA256 hashing
   */
  private calculateTransactionHash(tx: Partial<Transaction>): Uint8Array {
    const wasm = getWasm();

    debug(`\n=== CALCULATING TRANSACTION HASH (PREIMAGE) ===`);
    debug(`Number of outputs: ${tx.outputs!.length}`);

    // Start with 32 bytes of zeros
    const pblank = new Uint8Array(32).fill(0);
    let hashOutputs = new Uint8Array(32).fill(0);
    let hashOutputsSet = false;

    for (let i = 0; i < tx.outputs!.length; i++) {
      const output = tx.outputs![i];
      debug(`\nOutput ${i}: type=${output.type}`);

      // Serialize the output data (WITHOUT type byte - matches Dart's CTxOutBase.serialize())
      const serialized = serializeOutputData(output);
      debug(`  Serialized size: ${serialized.length} bytes`);
      debug(`  Serialized (first 64 bytes): ${bytesToHex(serialized.slice(0, 64))}`);

      // Double SHA256 the serialized output (hash256)
      let hash = wasm.hashSha256(serialized);
      hash = wasm.hashSha256(hash);
      debug(`  Double-SHA256: ${bytesToHex(hash)}`);

      // Prepare inputs for next hash
      const hsh1 = hash;
      const hsh2 = hashOutputsSet ? hashOutputs : pblank;
      debug(`  Previous hash: ${bytesToHex(hsh2).slice(0, 40)}...`);

      // Concatenate hsh1 and hsh2
      const combined = new Uint8Array(hsh1.length + hsh2.length);
      combined.set(hsh1, 0);
      combined.set(hsh2, hsh1.length);

      // temp = SHA256(combined)
      const temp = wasm.hashSha256(combined);

      // hashOutputs = SHA256(temp)
      const newHash = wasm.hashSha256(temp);
      hashOutputs = new Uint8Array(newHash);
      hashOutputsSet = true;
      debug(`  Running hash: ${bytesToHex(hashOutputs)}`);
    }

    debug(`\n=== FINAL TRANSACTION HASH (PREIMAGE) ===`);
    debug(`  ${bytesToHex(hashOutputs)}`);
    debug(`===========================================\n`);

    return hashOutputs;
  }

  /**
   * Generate random blinding factor
   */
  private generateRandomBlind(): Blind {
    const blind = new Uint8Array(32);
    crypto.getRandomValues(blind);
    return blind;
  }

  /**
   * Serialize transaction to hex
   *
   * Uses the serialization module to convert the transaction to Veil's binary format
   */
  private serializeTransaction(tx: Transaction): string {
    return serializeTransaction(tx);
  }

  /**
   * Calculate transaction ID
   */
  private async calculateTxid(txHex: string): Promise<string> {
    // TXID is double SHA256 of the transaction hex
    const txBytes = hexToBytes(txHex);
    const hash = await doubleSha256(txBytes);
    // Reverse byte order for display (Bitcoin convention)
    return bytesToHex(hash.reverse());
  }

  /**
   * Estimate transaction fee
   */
  estimateFee(numInputs: number, numOutputs: number): bigint {
    const size =
      100 + // Base
      numInputs * (this.config.ringSize * 33 + 100) + // Inputs
      numOutputs * (156); // Outputs with CT data

    const sizeKb = size / 1000;
    return BigInt(Math.ceil(sizeKb * this.config.feePerKb));
  }

  // ============================================================================
  // UTXO Management & Analysis
  // ============================================================================

  /**
   * Analyze UTXO set for fragmentation and provide recommendations
   */
  analyzeUTXOs(utxos: UTXO[]): {
    totalUtxos: number;
    totalValue: bigint;
    averageValue: bigint;
    largestUtxo: bigint;
    smallestUtxo: bigint;
    isFragmented: boolean;
    needsConsolidation: boolean;
    maxSendableInSingleTx: bigint;
    recommendation: string;
  } {
    if (utxos.length === 0) {
      return {
        totalUtxos: 0,
        totalValue: 0n,
        averageValue: 0n,
        largestUtxo: 0n,
        smallestUtxo: 0n,
        isFragmented: false,
        needsConsolidation: false,
        maxSendableInSingleTx: 0n,
        recommendation: 'No UTXOs available',
      };
    }

    const totalValue = utxos.reduce((sum, utxo) => sum + utxo.amount, 0n);
    const averageValue = totalValue / BigInt(utxos.length);
    const sorted = [...utxos].sort((a, b) => (a.amount > b.amount ? -1 : 1));
    const largestUtxo = sorted[0].amount;
    const smallestUtxo = sorted[sorted.length - 1].amount;

    // Calculate max sendable with 32 inputs
    const top32 = sorted.slice(0, Math.min(MAX_ANON_INPUTS, utxos.length));
    const maxWith32Inputs = top32.reduce((sum, utxo) => sum + utxo.amount, 0n);
    const estimatedFee = this.estimateFee(Math.min(MAX_ANON_INPUTS, utxos.length), 2);
    const maxSendableInSingleTx = maxWith32Inputs > estimatedFee ? maxWith32Inputs - estimatedFee : 0n;

    const isFragmented = utxos.length > CONSOLIDATION_THRESHOLD;
    const needsConsolidation = utxos.length > MAX_ANON_INPUTS;

    let recommendation = '';
    if (needsConsolidation) {
      recommendation = `⚠️  You have ${utxos.length} UTXOs, but can only use ${MAX_ANON_INPUTS} per transaction. ` +
        `Strongly recommend consolidating to avoid issues sending large amounts.`;
    } else if (isFragmented) {
      recommendation = `💡 You have ${utxos.length} UTXOs. Consider consolidating when fees are low to improve transaction efficiency.`;
    } else {
      recommendation = '✅ UTXO set is healthy.';
    }

    return {
      totalUtxos: utxos.length,
      totalValue,
      averageValue,
      largestUtxo,
      smallestUtxo,
      isFragmented,
      needsConsolidation,
      maxSendableInSingleTx,
      recommendation,
    };
  }

  /**
   * Check if an amount can be sent in a single transaction
   */
  canSendInSingleTransaction(utxos: UTXO[], amount: bigint): {
    canSend: boolean;
    requiredInputs: number;
    reason?: string;
  } {
    const sorted = [...utxos].sort((a, b) => (a.amount > b.amount ? -1 : 1));

    let totalValue = 0n;
    let inputCount = 0;

    for (const utxo of sorted) {
      if (inputCount >= MAX_ANON_INPUTS) {
        break;
      }

      totalValue += utxo.amount;
      inputCount++;

      const estimatedFee = this.estimateFee(inputCount, 2);

      if (totalValue >= amount + estimatedFee) {
        return {
          canSend: true,
          requiredInputs: inputCount,
        };
      }
    }

    return {
      canSend: false,
      requiredInputs: inputCount,
      reason: `Cannot send ${amount} in single transaction. Max with ${MAX_ANON_INPUTS} inputs: ${totalValue}`,
    };
  }

  /**
   * Plan how to split a large send into multiple transactions
   */
  planMultiTransaction(utxos: UTXO[], totalAmount: bigint): {
    transactions: Array<{
      inputUtxos: UTXO[];
      amount: bigint;
      estimatedFee: bigint;
    }>;
    totalFees: bigint;
    feasible: boolean;
    error?: string;
  } {
    const analysis = this.analyzeUTXOs(utxos);

    if (totalAmount > analysis.totalValue) {
      return {
        transactions: [],
        totalFees: 0n,
        feasible: false,
        error: `Insufficient funds: need ${totalAmount}, have ${analysis.totalValue}`,
      };
    }

    const sorted = [...utxos].sort((a, b) => (a.amount > b.amount ? -1 : 1));
    const transactions: Array<{
      inputUtxos: UTXO[];
      amount: bigint;
      estimatedFee: bigint;
    }> = [];

    let remainingAmount = totalAmount;
    let availableUtxos = [...sorted];
    let totalFees = 0n;

    while (remainingAmount > 0n && availableUtxos.length > 0) {
      const batchUtxos = availableUtxos.splice(0, Math.min(MAX_ANON_INPUTS, availableUtxos.length));
      const batchValue = batchUtxos.reduce((sum, utxo) => sum + utxo.amount, 0n);
      const estimatedFee = this.estimateFee(batchUtxos.length, 2);

      if (batchValue <= estimatedFee) {
        return {
          transactions: [],
          totalFees: 0n,
          feasible: false,
          error: 'UTXOs too small to cover fees',
        };
      }

      const sendable = batchValue - estimatedFee;
      const sendAmount = remainingAmount > sendable ? sendable : remainingAmount;

      transactions.push({
        inputUtxos: batchUtxos,
        amount: sendAmount,
        estimatedFee,
      });

      totalFees += estimatedFee;
      remainingAmount -= sendAmount;
    }

    if (remainingAmount > 0n) {
      return {
        transactions: [],
        totalFees: 0n,
        feasible: false,
        error: `Cannot send full amount even with multiple transactions. Short by: ${remainingAmount}`,
      };
    }

    return {
      transactions,
      totalFees,
      feasible: true,
    };
  }

  /**
   * Build a UTXO consolidation transaction
   *
   * Consolidates up to MAX_ANON_INPUTS UTXOs into a single output sent back to the same address
   */
  async buildConsolidationTransaction(
    spendKey: SecretKey,
    scanKey: SecretKey,
    utxos: UTXO[],
    decoyOutputs: any[],
    maxInputs: number = MAX_ANON_INPUTS
  ): Promise<BuildTransactionResult> {
    if (utxos.length === 0) {
      throw new Error('No UTXOs to consolidate');
    }

    if (maxInputs < 1 || maxInputs > MAX_ANON_INPUTS) {
      throw new Error(`maxInputs must be between 1 and ${MAX_ANON_INPUTS}`);
    }

    // Sort by value (largest first) and take up to maxInputs
    const sorted = [...utxos].sort((a, b) => (a.amount > b.amount ? -1 : 1));
    const selectedUtxos = sorted.slice(0, Math.min(maxInputs, utxos.length));

    // Calculate total input value
    const totalInput = selectedUtxos.reduce((sum, utxo) => sum + utxo.amount, 0n);

    // Estimate fee
    const estimatedFee = this.estimateFee(selectedUtxos.length, 1); // 1 output (no change)

    if (totalInput <= estimatedFee) {
      throw new Error('UTXOs too small to cover consolidation fee');
    }

    const outputAmount = totalInput - estimatedFee;

    // Build recipient (send to self)
    const spendPubkey = derivePublicKey(spendKey);
    const scanPubkey = derivePublicKey(scanKey);
    const stealthAddress = generateStealthAddress(scanPubkey, spendPubkey);

    const recipient: Recipient = {
      address: stealthAddress,
      amount: outputAmount,
    };

    debug(`[Consolidation] Consolidating ${selectedUtxos.length} UTXOs`);
    debug(`[Consolidation] Total input: ${satoshisToVeil(totalInput)} VEIL`);
    debug(`[Consolidation] Estimated fee: ${satoshisToVeil(estimatedFee)} VEIL`);
    debug(`[Consolidation] Output amount: ${satoshisToVeil(outputAmount)} VEIL`);

    // Build the transaction using the standard flow
    return await this.buildTransaction(
      spendKey,
      scanKey,
      [recipient],
      selectedUtxos,
      decoyOutputs
    );
  }

  /**
   * Build multiple consolidation transactions to consolidate all UTXOs
   *
   * Returns an array of transactions that will consolidate the UTXO set
   */
  async buildFullConsolidation(
    spendKey: SecretKey,
    scanKey: SecretKey,
    utxos: UTXO[]
  ): Promise<{
    transactions: BuildTransactionResult[];
    totalFees: bigint;
    originalUtxoCount: number;
    finalUtxoCount: number;
  }> {
    if (utxos.length === 0) {
      throw new Error('No UTXOs to consolidate');
    }

    const transactions: BuildTransactionResult[] = [];
    let totalFees = 0n;
    let remainingUtxos = [...utxos];

    debug(`[Full Consolidation] Starting with ${utxos.length} UTXOs`);

    let round = 1;
    while (remainingUtxos.length > 1) {
      debug(`[Full Consolidation] Round ${round}: ${remainingUtxos.length} UTXOs remaining`);

      // Take up to MAX_ANON_INPUTS
      const batchSize = Math.min(MAX_ANON_INPUTS, remainingUtxos.length);
      const batch = remainingUtxos.splice(0, batchSize);

      // Fetch decoys for this batch
      const decoys = await fetchDecoyOutputs(this.config.ringSize, batch.length);

      // Build consolidation transaction
      const tx = await this.buildConsolidationTransaction(
        spendKey,
        scanKey,
        batch,
        decoys,
        batchSize
      );

      transactions.push(tx);
      totalFees += tx.fee;

      // The output of this transaction becomes a new UTXO
      // (In practice, you'd need to wait for confirmation and rescan)
      debug(`[Full Consolidation] Round ${round} complete. Fee: ${satoshisToVeil(tx.fee)} VEIL`);

      round++;
    }

    const finalUtxoCount = remainingUtxos.length + transactions.length;

    debug(`[Full Consolidation] Complete!`);
    debug(`  - Original UTXOs: ${utxos.length}`);
    debug(`  - Final UTXOs: ${finalUtxoCount}`);
    debug(`  - Total fees: ${satoshisToVeil(totalFees)} VEIL`);
    debug(`  - Transactions needed: ${transactions.length}`);

    return {
      transactions,
      totalFees,
      originalUtxoCount: utxos.length,
      finalUtxoCount,
    };
  }

  // ============================================================================
  // CT -> RingCT Transaction Building (sendstealthtoringct)
  // ============================================================================

  /**
   * Send from CT (stealth) outputs to RingCT outputs
   *
   * This is the equivalent of the Veil Core `sendstealthtoringct` RPC command.
   * CT outputs use ECDSA signatures and standard scriptPubKey, while the outputs
   * are created as RingCT outputs with full privacy.
   *
   * @param spendKey - Spend private key
   * @param scanKey - Scan private key
   * @param recipients - Recipients and amounts
   * @param ctUtxos - CT UTXOs to spend
   * @returns Built transaction result
   *
   * @example
   * ```typescript
   * const result = await txBuilder.sendStealthToRingCT(
   *   spendKey,
   *   scanKey,
   *   [{ address: 'sv1qq...', amount: 100000000n }],
   *   myCTUtxos
   * );
   * console.log('TX:', result.txHex);
   * ```
   */
  async sendStealthToRingCT(
    spendKey: SecretKey,
    scanKey: SecretKey,
    recipients: Recipient[],
    ctUtxos: UTXO_CT[]
  ): Promise<BuildTransactionResult> {
    // Ensure WASM is initialized
    if (!this.wasmInitialized) {
      await this.initialize();
    }

    debug('[sendStealthToRingCT] Starting CT -> RingCT transaction build');
    debug(`[sendStealthToRingCT] Recipients: ${recipients.length}, CT UTXOs: ${ctUtxos.length}`);

    // Validate inputs
    if (recipients.length === 0) {
      throw new Error('At least one recipient is required');
    }
    if (ctUtxos.length === 0) {
      throw new Error('At least one CT UTXO is required');
    }

    // Calculate total output amount
    let totalOutputAmount = 0n;
    for (const r of recipients) {
      if (r.amount <= 0n) {
        throw new Error('Recipient amount must be positive');
      }
      totalOutputAmount += r.amount;
    }

    // Calculate total input amount
    let totalInputAmount = 0n;
    for (const utxo of ctUtxos) {
      totalInputAmount += utxo.amount;
    }

    debug(`[sendStealthToRingCT] Total input: ${satoshisToVeil(totalInputAmount)} VEIL`);
    debug(`[sendStealthToRingCT] Total output: ${satoshisToVeil(totalOutputAmount)} VEIL`);

    // Estimate fee (CT inputs are smaller than RingCT, ~150 bytes per input)
    const estimatedInputSize = ctUtxos.length * 150;
    // RingCT outputs are larger (~5500 bytes with range proof)
    const estimatedOutputSize = (recipients.length + 1) * 5500; // +1 for change
    const estimatedSize = 10 + estimatedInputSize + estimatedOutputSize + 100; // header + fee output
    const estimatedFee = BigInt(Math.ceil(estimatedSize / 1000)) * BigInt(this.config.feePerKb);

    debug(`[sendStealthToRingCT] Estimated size: ${estimatedSize} bytes`);
    debug(`[sendStealthToRingCT] Estimated fee: ${satoshisToVeil(estimatedFee)} VEIL`);

    // Check if we have enough funds
    const totalNeeded = totalOutputAmount + estimatedFee;
    if (totalInputAmount < totalNeeded) {
      throw new Error(`Insufficient funds: need ${satoshisToVeil(totalNeeded)} VEIL, have ${satoshisToVeil(totalInputAmount)} VEIL`);
    }

    // Calculate change
    const changeAmount = totalInputAmount - totalNeeded;
    debug(`[sendStealthToRingCT] Change amount: ${satoshisToVeil(changeAmount)} VEIL`);

    // Build CT inputs first to get input blinds
    const inputs: TxInputCT[] = [];
    const inputBlinds: Blind[] = [];

    for (const utxo of ctUtxos) {
      // Create unsigned input
      const input: TxInputCT = {
        prevout: {
          hash: hexToBytes(utxo.txid).reverse(), // Convert to internal byte order
          n: utxo.vout,
        },
        scriptSig: new Uint8Array(0), // Will be filled after signing
        nSequence: SEQUENCE_FINAL,
      };

      inputs.push(input);
      inputBlinds.push(utxo.blind);
    }

    // Build the transaction outputs (RingCT format)
    const outputs: TxOutput[] = [];
    const outputBlinds: Blind[] = [];
    const outputCommitments: Commitment[] = [];

    // Fee output (must be first)
    const feeOutput: TxOutputData = {
      type: OutputType.OUTPUT_DATA,
      address: '',
      amount: 0n,
      vData: this.encodeFeeData(estimatedFee),
    };
    outputs.push(feeOutput);

    // Derive keys for recipient outputs
    const spendPubkey = derivePublicKey(spendKey);
    const scanPubkey = derivePublicKey(scanKey);

    // Determine if we have a change output
    const hasChange = changeAmount > DUST_THRESHOLD;
    const changeAddress = hasChange ? generateStealthAddress(scanPubkey, spendPubkey) : null;

    // Build all outputs EXCEPT the last one with random blinds
    // The last output will use a calculated blind to balance the commitments
    const allOutputsToCreate: Array<{ address: StealthAddress; amount: bigint }> = [];
    for (const recipient of recipients) {
      allOutputsToCreate.push({ address: recipient.address, amount: recipient.amount });
    }
    if (hasChange && changeAddress) {
      allOutputsToCreate.push({ address: changeAddress, amount: changeAmount });
    }

    // Build all outputs except the last with random blinds
    for (let i = 0; i < allOutputsToCreate.length - 1; i++) {
      const { address, amount } = allOutputsToCreate[i];
      const outputResult = await this.buildRingCTOutput(address, amount);
      outputs.push(outputResult.output);
      outputBlinds.push(outputResult.blind);
      outputCommitments.push(outputResult.commitment);
    }

    // Calculate the blind for the last output to balance the commitments
    // sum(input_blinds) = sum(output_blinds)
    // last_blind = sum(input_blinds) - sum(other_output_blinds)
    const lastOutput = allOutputsToCreate[allOutputsToCreate.length - 1];

    // Use sumBlinds to calculate the balancing blind
    // nPositive = inputBlinds.length means those are added, rest are subtracted
    const blindsForSum = [...inputBlinds, ...outputBlinds];
    const nPositive = inputBlinds.length;
    const lastBlind = sumBlinds(blindsForSum, nPositive);

    debug(`[sendStealthToRingCT] Calculated balancing blind for last output`);

    // Build the last output with the calculated blind
    const lastOutputResult = await this.buildRingCTOutputWithBlind(
      lastOutput.address,
      lastOutput.amount,
      lastBlind
    );
    outputs.push(lastOutputResult.output);
    outputBlinds.push(lastBlind);
    outputCommitments.push(lastOutputResult.commitment);

    // Build partial transaction for sighash calculation
    const partialTx = {
      version: 2,
      inputs: inputs.map(inp => ({
        prevout: inp.prevout,
        nSequence: inp.nSequence,
      })),
      outputs: outputs,
      lockTime: 0,
    };

    // Sign each CT input
    for (let i = 0; i < ctUtxos.length; i++) {
      const utxo = ctUtxos[i];

      // Derive the spend key for this output
      const outputSpendKey = await deriveCTSpendKey(spendKey, scanKey, utxo.ephemeralPubkey);
      const outputPubkey = derivePublicKey(outputSpendKey);

      // Compute sighash
      const sighash = await computeCTSighash(
        partialTx,
        i,
        utxo.scriptPubKey,
        utxo.commitment,
        SIGHASH_ALL
      );

      // Sign with ECDSA
      const signature = ecdsaSign(sighash, outputSpendKey);

      // Build scriptSig (P2PKH format)
      const scriptSig = createP2PKHScriptSig(signature, outputPubkey, SIGHASH_ALL);
      inputs[i].scriptSig = scriptSig;
    }

    // Serialize the transaction
    const txHex = await this.serializeCTToRingCTTransaction(inputs, outputs, estimatedFee);

    // Calculate txid
    const txBytes = hexToBytes(txHex);
    const txidBytes = await doubleSha256(txBytes);
    const txid = bytesToHex(txidBytes.reverse());

    debug(`[sendStealthToRingCT] Transaction built successfully`);
    debug(`[sendStealthToRingCT] TXID: ${txid}`);
    debug(`[sendStealthToRingCT] Size: ${txBytes.length} bytes`);
    debug(`[sendStealthToRingCT] Fee: ${satoshisToVeil(estimatedFee)} VEIL`);

    return {
      txHex,
      txid,
      fee: estimatedFee,
      change: changeAmount,
      size: txBytes.length,
      inputs: ctUtxos as unknown as UTXO[], // CT UTXOs (different type, cast for interface)
      outputs: outputs,
    };
  }

  /**
   * Build a RingCT output for CT -> RingCT transactions
   */
  private async buildRingCTOutput(
    address: StealthAddress,
    amount: bigint
  ): Promise<{
    output: TxOutputRingCT;
    blind: Blind;
    commitment: Commitment;
  }> {
    // Generate ephemeral keys for this output
    const ephemeralResult = await generateEphemeralKeys(address);

    // Generate random blinding factor
    const blind = getRandomBytes(32);

    // Create commitment
    const commitment = createCommitment(amount, blind);

    // Generate range proof
    const rangeProofParams = selectRangeProofParameters(amount);
    const rangeProof = generateRangeProof({
      commitment,
      value: amount,
      blind,
      nonce: ephemeralResult.sharedSecret,
      message: new Uint8Array(0),
      minValue: 0n,
      exp: rangeProofParams.exponent,
      minBits: rangeProofParams.minBits,
    });

    // Build vData (ephemeral pubkey)
    const vData = concatBytes(
      new Uint8Array([0x21]), // Push 33 bytes
      ephemeralResult.ephemeralPubkey
    );

    const output: TxOutputRingCT = {
      type: OutputType.OUTPUT_RINGCT,
      address,
      amount,
      pk: ephemeralResult.destPubkey,
      commitment,
      vData,
      vRangeproof: rangeProof.proof,
      blind,
    };

    return { output, blind, commitment };
  }

  /**
   * Build a RingCT output with a specific blind (for commitment balancing)
   */
  private async buildRingCTOutputWithBlind(
    address: StealthAddress,
    amount: bigint,
    blind: Blind
  ): Promise<{
    output: TxOutputRingCT;
    commitment: Commitment;
  }> {
    // Generate ephemeral keys for this output
    const ephemeralResult = await generateEphemeralKeys(address);

    // Create commitment with the provided blind
    const commitment = createCommitment(amount, blind);

    // Generate range proof
    const rangeProofParams = selectRangeProofParameters(amount);
    const rangeProof = generateRangeProof({
      commitment,
      value: amount,
      blind,
      nonce: ephemeralResult.sharedSecret,
      message: new Uint8Array(0),
      minValue: 0n,
      exp: rangeProofParams.exponent,
      minBits: rangeProofParams.minBits,
    });

    // Build vData (ephemeral pubkey)
    const vData = concatBytes(
      new Uint8Array([0x21]), // Push 33 bytes
      ephemeralResult.ephemeralPubkey
    );

    const output: TxOutputRingCT = {
      type: OutputType.OUTPUT_RINGCT,
      address,
      amount,
      pk: ephemeralResult.destPubkey,
      commitment,
      vData,
      vRangeproof: rangeProof.proof,
      blind,
    };

    return { output, commitment };
  }

  /**
   * Encode fee data for OUTPUT_DATA
   */
  private encodeFeeData(fee: bigint): Uint8Array {
    // Format: DO_FEE (1 byte) + varint(fee)
    const feeBytes: number[] = [DataOutputTypes.DO_FEE];

    // Encode fee as varint
    let remaining = fee;
    do {
      let byte = Number(remaining & 0x7fn);
      remaining = remaining >> 7n;
      if (remaining > 0n) {
        byte |= 0x80;
      }
      feeBytes.push(byte);
    } while (remaining > 0n);

    return new Uint8Array(feeBytes);
  }

  /**
   * Serialize a CT -> RingCT transaction
   *
   * Veil transaction format (from transaction.h:722):
   * 1. Version low byte (1 byte)
   * 2. Transaction type (1 byte) - high byte of version
   * 3. Has witness flag (1 byte)
   * 4. Lock time (4 bytes)
   * 5. Inputs (with varint count)
   * 6. Outputs (with varint count, each prefixed by output type)
   * 7. Witness data (if has witness)
   */
  private async serializeCTToRingCTTransaction(
    inputs: TxInputCT[],
    outputs: TxOutput[],
    fee: bigint
  ): Promise<string> {
    const parts: Uint8Array[] = [];

    // Version: low byte = 2, high byte = 0 (TXN_STANDARD)
    const version = 2;
    const txType = 0; // TXN_STANDARD
    parts.push(new Uint8Array([version & 0xFF]));       // Version low byte
    parts.push(new Uint8Array([txType & 0xFF]));        // Transaction type

    // Has witness flag (0 = no witness for CT inputs)
    parts.push(new Uint8Array([0x00]));

    // Lock time (4 bytes, little-endian)
    const lockTimeBytes = new Uint8Array(4);
    parts.push(lockTimeBytes);

    // Number of inputs (varint)
    parts.push(this.encodeVarInt(BigInt(inputs.length)));

    // Inputs
    for (const input of inputs) {
      parts.push(serializeCTInput(input));
    }

    // Number of outputs (varint)
    parts.push(this.encodeVarInt(BigInt(outputs.length)));

    // Outputs (each prefixed by output type)
    for (const output of outputs) {
      parts.push(serializeOutput(output));
    }

    return bytesToHex(concatBytes(...parts));
  }
}
