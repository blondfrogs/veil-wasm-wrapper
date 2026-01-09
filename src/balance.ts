/**
 * Balance Retrieval for Veil Wallets
 *
 * Provides a single-call function to get wallet balance by scanning the blockchain
 * with support for caching and pagination.
 */

import { UTXO, UTXO_CT, SecretKey } from './types';
import { RpcRequester } from './rpc';
import { parseWatchOnlyTransactions, parseWatchOnlyTransactionsCT, ParsedUTXO, ParsedUTXO_CT } from './watch-only-tx';
import { bytesToHex } from './utils';
import { debug } from './debug';

// ============================================================================
// Types
// ============================================================================

/**
 * Callback function to stream batches of unspent UTXOs as they are discovered
 * Receives an array of unspent UTXOs for each processing batch
 * Useful for large wallets to process incrementally without overwhelming the caller
 */
export type OnUtxoCallback = (utxos: ParsedUTXO[]) => void | Promise<void>;

/**
 * Options for getting wallet balance
 */
export interface GetBalanceOptions {
  /**
   * Known spent key images (hex strings) to skip RPC checks
   * Use this to cache spent status between calls
   */
  knownSpentKeyImages?: Set<string> | string[];

  /**
   * Starting index for getwatchonlytxes pagination
   * Use lastProcessedIndex from previous call to resume
   */
  startIndex?: number;

  /**
   * Number of key images to check per RPC call
   * Default: 1000
   */
  keyImageBatchSize?: number;

  /**
   * Optional callback to stream batches of unspent UTXOs as they are discovered
   * Called once per batch after spent filtering (batches aligned with RPC pagination)
   * Receives only unspent UTXOs that contribute to the balance
   * Useful for large wallets to process incrementally or update UI in real-time
   */
  onUtxoDiscovered?: OnUtxoCallback;
}

/**
 * Result from getting wallet balance
 */
export interface BalanceResult {
  /** Total balance of all unspent UTXOs (in satoshis) */
  totalBalance: bigint;

  /** All unspent UTXOs found */
  utxos: UTXO[];

  /** Last processed index - use this as startIndex for next call to skip re-scanning */
  lastProcessedIndex: number;

  /** All spent key images found (hex strings) - cache these for next call */
  spentKeyImages: string[];

  /** Total number of outputs scanned from blockchain */
  totalOutputsScanned: number;

  /** Number of outputs owned by this wallet */
  ownedOutputsFound: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check key images against the blockchain to determine spent status
 *
 * Batches key images into groups and checks them via RPC. Updates the provided
 * Set with newly discovered spent key images.
 *
 * @param keyImages - Array of key images to check
 * @param alreadyKnownSpent - Set of key images already known to be spent (will be updated)
 * @param keyImageBatchSize - Maximum number of key images per RPC call
 * @param rpc - RPC client to use
 */
async function checkKeyImagesSpentStatus(
  keyImages: Uint8Array[],
  alreadyKnownSpent: Set<string>,
  keyImageBatchSize: number,
  rpc: typeof RpcRequester
): Promise<void> {
  // Filter out key images we already know are spent
  const keyImagesToCheck = keyImages.filter(ki => {
    const hex = bytesToHex(ki);
    return !alreadyKnownSpent.has(hex);
  });

  if (keyImagesToCheck.length === 0) {
    return; // Nothing new to check
  }

  debug(`[checkKeyImagesSpentStatus] Checking ${keyImagesToCheck.length} key images`);

  // Check in batches to avoid overwhelming the RPC server
  for (let i = 0; i < keyImagesToCheck.length; i += keyImageBatchSize) {
    const batch = keyImagesToCheck.slice(i, i + keyImageBatchSize);

    const results = await rpc.checkKeyImages(batch);

    // Update the set with newly discovered spent key images
    for (const result of results) {
      if (result.spent || result.spentinmempool) {
        alreadyKnownSpent.add(result.keyImage);
      }
    }
  }
}

/**
 * Convert ParsedUTXO to UTXO format and filter out spent ones
 *
 * Takes raw parsed UTXOs, checks each against the spent key images set,
 * and converts unspent ones to the final UTXO format.
 *
 * @param parsedUtxos - Raw parsed UTXOs from transaction scanning
 * @param spentKeyImages - Set of spent key image hex strings
 * @returns Array of unspent UTXOs and array of ParsedUTXOs for callback
 */
function filterAndConvertUnspentUtxos(
  parsedUtxos: ParsedUTXO[],
  spentKeyImages: Set<string>
): { unspentUtxos: UTXO[]; unspentParsed: ParsedUTXO[] } {
  const unspentUtxos: UTXO[] = [];
  const unspentParsed: ParsedUTXO[] = [];

  for (const parsedUtxo of parsedUtxos) {
    // Skip if missing critical fields
    if (!parsedUtxo.keyImage || parsedUtxo.amount === undefined) {
      continue;
    }

    // Check if this UTXO has been spent
    const isSpent = spentKeyImages.has(bytesToHex(parsedUtxo.keyImage));
    if (isSpent) {
      continue; // Skip spent UTXOs
    }

    // Convert to final UTXO format
    const utxo: UTXO = {
      txid: parsedUtxo.txid || '',
      vout: parsedUtxo.vout || 0,
      amount: parsedUtxo.amount,
      commitment: parsedUtxo.commitment!,
      blind: parsedUtxo.blind!,
      pubkey: parsedUtxo.pubkey!,
      ephemeralPubkey: parsedUtxo.ephemeralPubkey!,
      blockHeight: 0, // Not available from RPC
      spendable: true, // Unspent means spendable
      ringctIndex: parsedUtxo.ringctIndex,
    };

    unspentUtxos.push(utxo);
    unspentParsed.push(parsedUtxo);
  }

  return { unspentUtxos, unspentParsed };
}

/**
 * Validate parameters for getBalance function
 * @throws Error if any parameter is invalid
 */
function validateGetBalanceParams(
  spendSecret: SecretKey,
  scanSecret: SecretKey,
  options: GetBalanceOptions
): void {
  // Validate spendSecret
  if (!spendSecret || !(spendSecret instanceof Uint8Array)) {
    throw new Error('Invalid spendSecret: must be a Uint8Array');
  }
  if (spendSecret.length !== 32) {
    throw new Error('Invalid spendSecret: must be 32 bytes');
  }

  // Validate scanSecret
  if (!scanSecret || !(scanSecret instanceof Uint8Array)) {
    throw new Error('Invalid scanSecret: must be a Uint8Array');
  }
  if (scanSecret.length !== 32) {
    throw new Error('Invalid scanSecret: must be 32 bytes');
  }

  const { startIndex = 0, keyImageBatchSize = 1000, onUtxoDiscovered, knownSpentKeyImages } = options;

  // Validate startIndex
  if (typeof startIndex !== 'number' || startIndex < 0 || !Number.isInteger(startIndex)) {
    throw new Error('Invalid startIndex: must be a non-negative integer');
  }

  // Validate keyImageBatchSize
  if (typeof keyImageBatchSize !== 'number' || keyImageBatchSize < 1 || keyImageBatchSize > 10000) {
    throw new Error('Invalid keyImageBatchSize: must be between 1 and 10000');
  }

  // Validate onUtxoDiscovered callback
  if (onUtxoDiscovered !== undefined && typeof onUtxoDiscovered !== 'function') {
    throw new Error('Invalid onUtxoDiscovered: must be a function');
  }

  // Validate hex strings in knownSpentKeyImages
  if (knownSpentKeyImages) {
    const kiSet = knownSpentKeyImages instanceof Set ? knownSpentKeyImages : new Set(knownSpentKeyImages);
    for (const ki of kiSet) {
      if (typeof ki !== 'string' || !/^[0-9a-fA-F]{66}$/.test(ki)) {
        throw new Error(`Invalid key image in knownSpentKeyImages: "${ki}" (must be 66-char hex string)`);
      }
    }
  }
}

// ============================================================================
// Main Function
// ============================================================================

/**
 * Get wallet balance in a single call
 *
 * This function:
 * 1. Fetches watch-only transactions from the blockchain (paginated, 1000 at a time)
 * 2. Scans outputs to find those belonging to the wallet
 * 3. Checks key images to determine spent status (batched)
 * 4. Calculates total balance of unspent UTXOs
 * 5. Returns state for caching and resumption
 *
 * @param spendSecret - Wallet spend private key
 * @param scanSecret - Wallet scan private key
 * @param rpc - RPC client instance (optional, uses RpcRequester by default)
 * @param options - Configuration options
 * @returns Balance result with unspent UTXOs and caching state
 *
 * @example
 * ```typescript
 * // First call
 * const result = await getBalance(wallet.spendSecret, wallet.scanSecret);
 * console.log('Balance:', satoshisToVeil(result.totalBalance), 'VEIL');
 *
 * // Later call - use cached state to skip re-scanning and re-checking
 * const result2 = await getBalance(wallet.spendSecret, wallet.scanSecret, undefined, {
 *   startIndex: result.lastProcessedIndex,
 *   knownSpentKeyImages: result.spentKeyImages
 * });
 * ```
 */
export async function getBalance(
  spendSecret: SecretKey,
  scanSecret: SecretKey,
  rpc: typeof RpcRequester = RpcRequester,
  options: GetBalanceOptions = {}
): Promise<BalanceResult> {
  // Validate all parameters
  validateGetBalanceParams(spendSecret, scanSecret, options);

  const {
    knownSpentKeyImages = [],
    startIndex = 0,
    keyImageBatchSize = 1000,
    onUtxoDiscovered,
  } = options;

  // Convert knownSpentKeyImages to Set for O(1) lookups
  const knownSpentSet = knownSpentKeyImages instanceof Set
    ? knownSpentKeyImages
    : new Set(knownSpentKeyImages);

  debug('[getBalance] Starting balance fetch');
  debug(`[getBalance] Options: startIndex=${startIndex}, keyImageBatchSize=${keyImageBatchSize}`);
  debug(`[getBalance] Known spent key images: ${knownSpentSet.size}`);

  // Process transactions in chunks to minimize memory usage
  // Each iteration: fetch page → parse → check key images → filter → callback → clear
  debug('[getBalance] Processing transactions in chunks for memory efficiency...');

  // Running state across all pages
  const allUnspentUtxos: UTXO[] = []; // Only keep unspent ones
  let totalBalance = 0n;
  let currentIndex = startIndex;
  let totalOutputsScanned = 0;
  let totalOwnedOutputsFound = 0;
  let lastProcessedIndex = startIndex;

  // Track all spent key images across all pages
  const allSpentKeyImages = new Set<string>(knownSpentSet);

  const scanSecretHex = bytesToHex(scanSecret);

  while (true) {
    debug(`[getBalance] ═══ Processing page starting at index ${currentIndex} ═══`);

    // ========================================================================
    // Step 1: Fetch one page of transactions (up to 1000)
    // ========================================================================
    const response = await rpc.getWatchOnlyTxes(scanSecretHex, currentIndex);
    const anonTxs = response?.anon || [];

    if (!anonTxs || anonTxs.length === 0) {
      debug(`[getBalance] No more transactions (got ${anonTxs.length} results)`);
      break;
    }

    totalOutputsScanned += anonTxs.length;
    debug(`[getBalance] Step 1: Fetched ${anonTxs.length} RingCT transactions`);

    // ========================================================================
    // Step 2: Parse transactions for this page only
    // ========================================================================
    const txHexArray = anonTxs.map((item: any) => item.raw || item.hex || item);
    const metadata = anonTxs.map((item: any) => ({
      amount: item.amount,
      blind: item.blind,
      ringctIndex: item.ringct_index,
    }));

    let pageParsedUtxos: ParsedUTXO[];
    try {
      pageParsedUtxos = await parseWatchOnlyTransactions(
        txHexArray,
        spendSecret,
        scanSecret,
        metadata
      );

      debug(`[getBalance] Step 2: Parsed ${pageParsedUtxos.length} owned UTXOs from this page`);
      totalOwnedOutputsFound += pageParsedUtxos.length;
    } catch (error: any) {
      debug(`[getBalance] Error parsing batch: ${error.message}`);
      throw new Error(`Failed to parse transactions at index ${currentIndex}: ${error.message}`);
    }

    // ========================================================================
    // Step 3: Check key images for this page's UTXOs
    // ========================================================================
    const pageKeyImages = pageParsedUtxos
      .map(utxo => utxo.keyImage)
      .filter((ki): ki is Uint8Array => ki !== undefined);

    debug(`[getBalance] Step 3: Checking ${pageKeyImages.length} key images`);

    await checkKeyImagesSpentStatus(
      pageKeyImages,
      allSpentKeyImages,
      keyImageBatchSize,
      rpc
    );

    // ========================================================================
    // Step 4: Filter unspent UTXOs and calculate balance for this page
    // ========================================================================
    const { unspentUtxos: pageUnspentUtxos, unspentParsed: pageUnspentParsed } =
      filterAndConvertUnspentUtxos(pageParsedUtxos, allSpentKeyImages);

    // Add to running totals
    allUnspentUtxos.push(...pageUnspentUtxos);
    for (const utxo of pageUnspentUtxos) {
      totalBalance += utxo.amount;
    }

    debug(`[getBalance] Step 4: Found ${pageUnspentUtxos.length} unspent UTXOs in this page`);

    // ========================================================================
    // Step 5: Invoke callback with this page's unspent UTXOs
    // ========================================================================
    if (onUtxoDiscovered && pageUnspentParsed.length > 0) {
      debug(`[getBalance] Step 5: Calling callback with ${pageUnspentParsed.length} unspent UTXOs`);
      await onUtxoDiscovered(pageUnspentParsed);
    }

    // Page is now fully processed and can be garbage collected
    // Only keeping aggregated state (allUnspentUtxos, totalBalance, allSpentKeyImages)

    // ========================================================================
    // Step 6: Update pagination state
    // ========================================================================
    const lastTx = anonTxs[anonTxs.length - 1];
    if (lastTx?.dbindex !== undefined) {
      lastProcessedIndex = lastTx.dbindex + 1;
      debug(`[getBalance] Updated lastProcessedIndex to ${lastProcessedIndex}`);
    }

    // Check if we've reached the end
    if (anonTxs.length < 1000) {
      debug('[getBalance] Reached end of transactions (got less than 1000)');
      break;
    }

    currentIndex = lastProcessedIndex;
  }

  debug(`[getBalance] ═══ Processing complete ═══`);
  debug(`[getBalance] Total outputs scanned: ${totalOutputsScanned}`);
  debug(`[getBalance] Total owned outputs: ${totalOwnedOutputsFound}`);
  debug(`[getBalance] Total unspent UTXOs: ${allUnspentUtxos.length}`);
  debug(`[getBalance] Total balance: ${totalBalance}`);

  return {
    totalBalance,
    utxos: allUnspentUtxos,
    lastProcessedIndex,
    spentKeyImages: Array.from(allSpentKeyImages),
    totalOutputsScanned,
    ownedOutputsFound: totalOwnedOutputsFound,
  };
}

// ============================================================================
// CT (Stealth) Balance Functions
// ============================================================================

/**
 * Callback function to stream batches of CT UTXOs as they are discovered
 */
export type OnUtxoCTCallback = (utxos: ParsedUTXO_CT[]) => void | Promise<void>;

/**
 * Options for getting CT wallet balance
 */
export interface GetBalanceCTOptions {
  /**
   * Starting index for getwatchonlytxes pagination
   */
  startIndex?: number;

  /**
   * Known spent txid:vout pairs (e.g., "abc123:0") to skip
   * CT outputs don't use key images - track spent status via outpoints
   */
  knownSpentOutpoints?: Set<string> | string[];

  /**
   * Optional callback to stream batches of UTXOs as they are discovered
   */
  onUtxoDiscovered?: OnUtxoCTCallback;
}

/**
 * Result from getting CT wallet balance
 */
export interface BalanceResultCT {
  /** Total balance of all unspent CT UTXOs (in satoshis) */
  totalBalance: bigint;

  /** All unspent CT UTXOs found */
  utxos: UTXO_CT[];

  /** Last processed index - use this as startIndex for next call */
  lastProcessedIndex: number;

  /** Total number of outputs scanned from blockchain */
  totalOutputsScanned: number;

  /** Number of outputs owned by this wallet */
  ownedOutputsFound: number;
}

/**
 * Convert ParsedUTXO_CT to UTXO_CT format
 */
function convertParsedCTToUtxo(
  parsedUtxos: ParsedUTXO_CT[],
  spentOutpoints: Set<string>
): { unspentUtxos: UTXO_CT[]; unspentParsed: ParsedUTXO_CT[] } {
  const unspentUtxos: UTXO_CT[] = [];
  const unspentParsed: ParsedUTXO_CT[] = [];

  for (const parsedUtxo of parsedUtxos) {
    // Skip if missing critical fields
    if (!parsedUtxo.scriptPubKey || parsedUtxo.amount === undefined) {
      continue;
    }

    // Check if this UTXO has been spent (by outpoint)
    const outpoint = `${parsedUtxo.txid}:${parsedUtxo.vout}`;
    if (spentOutpoints.has(outpoint)) {
      continue;
    }

    // Convert to UTXO_CT format
    const utxo: UTXO_CT = {
      txid: parsedUtxo.txid || '',
      vout: parsedUtxo.vout || 0,
      amount: parsedUtxo.amount,
      commitment: parsedUtxo.commitment!,
      blind: parsedUtxo.blind!,
      scriptPubKey: parsedUtxo.scriptPubKey!,
      pubkey: parsedUtxo.pubkey!,
      ephemeralPubkey: parsedUtxo.ephemeralPubkey!,
      blockHeight: 0,
      spendable: true,
    };

    unspentUtxos.push(utxo);
    unspentParsed.push(parsedUtxo);
  }

  return { unspentUtxos, unspentParsed };
}

/**
 * Get CT (stealth) wallet balance in a single call
 *
 * This function scans for CT outputs only (not RingCT).
 * CT outputs use scriptPubKey and ECDSA signatures, not ring signatures.
 *
 * @param spendSecret - Wallet spend private key
 * @param scanSecret - Wallet scan private key
 * @param rpc - RPC client instance (optional, uses RpcRequester by default)
 * @param options - Configuration options
 * @returns Balance result with unspent CT UTXOs
 *
 * @example
 * ```typescript
 * const result = await getBalanceCT(wallet.spendSecret, wallet.scanSecret);
 * console.log('CT Balance:', satoshisToVeil(result.totalBalance), 'VEIL');
 * console.log('CT UTXOs:', result.utxos.length);
 * ```
 */
export async function getBalanceCT(
  spendSecret: SecretKey,
  scanSecret: SecretKey,
  rpc: typeof RpcRequester = RpcRequester,
  options: GetBalanceCTOptions = {}
): Promise<BalanceResultCT> {
  const {
    startIndex = 0,
    knownSpentOutpoints = [],
    onUtxoDiscovered,
  } = options;

  // Convert to Set for O(1) lookups
  const spentOutpoints = knownSpentOutpoints instanceof Set
    ? knownSpentOutpoints
    : new Set(knownSpentOutpoints);

  debug('[getBalanceCT] Starting CT balance fetch');
  debug(`[getBalanceCT] Options: startIndex=${startIndex}`);
  debug(`[getBalanceCT] Known spent outpoints: ${spentOutpoints.size}`);

  const allUnspentUtxos: UTXO_CT[] = [];
  let totalBalance = 0n;
  let currentIndex = startIndex;
  let totalOutputsScanned = 0;
  let totalOwnedOutputsFound = 0;
  let lastProcessedIndex = startIndex;

  const scanSecretHex = bytesToHex(scanSecret);

  while (true) {
    debug(`[getBalanceCT] ═══ Processing page starting at index ${currentIndex} ═══`);

    // Fetch transactions
    const response = await rpc.getWatchOnlyTxes(scanSecretHex, currentIndex);
    const stealthTxs = response?.stealth || [];

    if (!stealthTxs || stealthTxs.length === 0) {
      debug(`[getBalanceCT] No more CT transactions (got ${stealthTxs.length} results)`);
      break;
    }

    totalOutputsScanned += stealthTxs.length;
    debug(`[getBalanceCT] Fetched ${stealthTxs.length} CT transactions`);

    // Parse transactions
    const txHexArray = stealthTxs.map((item: any) => item.raw || item.hex || item);
    const metadata = stealthTxs.map((item: any) => ({
      amount: item.amount,
      blind: item.blind,
    }));

    let pageParsedUtxos: ParsedUTXO_CT[];
    try {
      pageParsedUtxos = await parseWatchOnlyTransactionsCT(
        txHexArray,
        spendSecret,
        scanSecret,
        metadata
      );

      debug(`[getBalanceCT] Parsed ${pageParsedUtxos.length} owned CT UTXOs from this page`);
      totalOwnedOutputsFound += pageParsedUtxos.length;
    } catch (error: any) {
      debug(`[getBalanceCT] Error parsing batch: ${error.message}`);
      throw new Error(`Failed to parse CT transactions at index ${currentIndex}: ${error.message}`);
    }

    // Filter unspent and convert
    const { unspentUtxos: pageUnspentUtxos, unspentParsed: pageUnspentParsed } =
      convertParsedCTToUtxo(pageParsedUtxos, spentOutpoints);

    // Add to totals
    allUnspentUtxos.push(...pageUnspentUtxos);
    for (const utxo of pageUnspentUtxos) {
      totalBalance += utxo.amount;
    }

    debug(`[getBalanceCT] Found ${pageUnspentUtxos.length} unspent CT UTXOs in this page`);

    // Invoke callback
    if (onUtxoDiscovered && pageUnspentParsed.length > 0) {
      debug(`[getBalanceCT] Calling callback with ${pageUnspentParsed.length} CT UTXOs`);
      await onUtxoDiscovered(pageUnspentParsed);
    }

    // Update pagination
    const lastTx = stealthTxs[stealthTxs.length - 1];
    if (lastTx?.dbindex !== undefined) {
      lastProcessedIndex = lastTx.dbindex + 1;
    }

    if (stealthTxs.length < 1000) {
      debug('[getBalanceCT] Reached end of CT transactions');
      break;
    }

    currentIndex = lastProcessedIndex;
  }

  debug(`[getBalanceCT] ═══ Processing complete ═══`);
  debug(`[getBalanceCT] Total CT outputs scanned: ${totalOutputsScanned}`);
  debug(`[getBalanceCT] Total CT owned outputs: ${totalOwnedOutputsFound}`);
  debug(`[getBalanceCT] Total unspent CT UTXOs: ${allUnspentUtxos.length}`);
  debug(`[getBalanceCT] Total CT balance: ${totalBalance}`);

  return {
    totalBalance,
    utxos: allUnspentUtxos,
    lastProcessedIndex,
    totalOutputsScanned,
    ownedOutputsFound: totalOwnedOutputsFound,
  };
}
