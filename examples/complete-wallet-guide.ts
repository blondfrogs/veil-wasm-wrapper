/**
 * ===========================================================================
 * VEIL WALLET INTEGRATION GUIDE - Complete Reference Implementation
 * ===========================================================================
 *
 * This is the ONLY file you need to understand to build a Veil wallet!
 *
 * This example shows the complete wallet lifecycle:
 * 1. ✅ Create/Restore Wallet
 * 2. ✅ Import to Watch-Only Wallet (RPC)
 * 3. ✅ Fetch Transactions (getwatchonlytxes)
 * 4. ✅ Parse Transactions into UTXOs
 * 5. ✅ Check Spent Status
 * 6. ✅ Get Balance
 * 7. ✅ Send VEIL (with validation)
 *
 * Copy this file and adapt it to your wallet software!
 */

import {
  initWasm,
  createWallet,
  restoreWallet,
  validateAddress,
  isValidAddress,
  parseWatchOnlyTransactions,
  TransactionBuilder,
  RpcRequester,
  bytesToHex,
  hexToBytes,
  satoshisToVeil,
  type VeilWallet,
  type UTXO,
} from '../src';

// ===========================================================================
// STEP 1: CREATE OR RESTORE WALLET
// ===========================================================================

/**
 * Create a brand new Veil wallet
 *
 * Returns:
 * - stealthAddress: The address to share (starts with "sv1")
 * - spendSecretHex: Private key for spending (BACK UP!)
 * - scanSecretHex: Private key for scanning (BACK UP!)
 * - spendSecret/scanSecret: Same keys in Uint8Array format
 * - spendPubkey/scanPubkey: Public keys (derived)
 */
function step1_CreateWallet(): VeilWallet {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('STEP 1: CREATE WALLET');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // ONE LINE - That's it!
  const wallet = createWallet();

  console.log('✅ New wallet created!');
  console.log(`   Address: ${wallet.stealthAddress}`);
  console.log(`   Spend Key: ${wallet.spendSecretHex.slice(0, 20)}...`);
  console.log(`   Scan Key: ${wallet.scanSecretHex.slice(0, 20)}...`);
  console.log('\n💾 CRITICAL: Store these keys encrypted!');
  console.log('   - spendSecretHex: Required for sending VEIL');
  console.log('   - scanSecretHex: Required for scanning transactions');
  console.log('   - If lost, wallet funds are UNRECOVERABLE!');

  return wallet;
}

/**
 * Restore an existing wallet from backup keys
 */
function step1_RestoreWallet(spendKeyHex: string, scanKeyHex: string): VeilWallet {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('STEP 1: RESTORE WALLET');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // ONE LINE - Restore from keys
  const wallet = restoreWallet(spendKeyHex, scanKeyHex);

  console.log('✅ Wallet restored!');
  console.log(`   Address: ${wallet.stealthAddress}`);

  return wallet;
}

// ===========================================================================
// STEP 2: IMPORT ADDRESS TO VEIL NODE (Watch-Only Wallet)
// ===========================================================================

/**
 * Import the wallet address to Veil node for automatic transaction scanning
 *
 * The node will scan the blockchain and find all transactions sent to this address.
 * This enables the "light wallet" functionality.
 *
 * @param wallet - Your wallet from step 1
 * @param fromTimestamp - Unix timestamp to start scanning from (0 = genesis)
 */
async function step2_ImportToNode(wallet: VeilWallet, fromTimestamp: number = 0): Promise<boolean> {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('STEP 2: IMPORT TO WATCH-ONLY WALLET');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  try {
    console.log('   Importing address to Veil node...');
    console.log(`   Address: ${wallet.stealthAddress}`);

    const result = await RpcRequester.importLightwalletAddress(
      wallet.scanSecretHex,           // Scan key (private) - needed to detect transactions
      bytesToHex(wallet.spendPubkey), // Spend key (public) - NOT the private key!
      fromTimestamp                    // Start scanning from this time
    );

    console.log('✅ Address imported successfully!');

    // Check sync status
    const status = await RpcRequester.getWatchOnlyStatus(
      wallet.scanSecretHex,
      bytesToHex(wallet.spendPubkey)
    );

    console.log(`   Sync Status: ${status.status || 'unknown'}`);
    console.log('   The node will now scan for transactions to this address.');
    console.log('   This may take a few minutes for the first sync.');

    return true;
  } catch (error: any) {
    console.log('⚠️  Could not import address:', error.message);
    console.log('   This is expected if using the public explorer API.');
    console.log('   For full functionality, run your own Veil node.');
    return false;
  }
}

// ===========================================================================
// STEP 3: FETCH TRANSACTIONS FROM NODE
// ===========================================================================

/**
 * Fetch all transactions for this wallet from the Veil node
 *
 * This uses the getwatchonlytxes RPC method which returns transactions
 * that have been sent to your stealth address.
 *
 * @param wallet - Your wallet
 * @param offset - Pagination offset (default: 0)
 * @returns Raw transaction hex strings
 */
async function step3_FetchTransactions(wallet: VeilWallet, offset: number = 0): Promise<string[]> {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('STEP 3: FETCH TRANSACTIONS FROM NODE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  try {
    // Check if node has finished syncing
    const status = await RpcRequester.getWatchOnlyStatus(
      wallet.scanSecretHex,
      bytesToHex(wallet.spendPubkey)
    );

    console.log(`   Sync Status: ${status.status || 'unknown'}`);

    if (status.status !== 'synced') {
      console.log('⚠️  Node is still syncing. Please wait and try again.');
      return [];
    }

    // Fetch transactions
    console.log('   Fetching watch-only transactions...');
    const txResult = await RpcRequester.getWatchOnlyTxes(
      wallet.scanSecretHex,
      offset
    );

    if (!txResult || !txResult.anon || txResult.anon.length === 0) {
      console.log('   No transactions found yet.');
      console.log(`   Send VEIL to: ${wallet.stealthAddress}`);
      return [];
    }

    console.log(`✅ Found ${txResult.anon.length} RingCT transaction(s)!`);

    // Extract raw transaction data
    const rawTxs = txResult.anon.map((tx: any) => tx.raw);
    return rawTxs;
  } catch (error: any) {
    console.log('❌ Error fetching transactions:', error.message);
    return [];
  }
}

// ===========================================================================
// STEP 4: PARSE TRANSACTIONS INTO UTXOs
// ===========================================================================

/**
 * Parse raw transaction data into spendable UTXOs
 *
 * This extracts all the cryptographic data needed to spend the outputs:
 * - Amount (value in satoshis)
 * - Commitment (Pedersen commitment)
 * - Blind (blinding factor)
 * - Public key
 * - Ephemeral public key
 * - Key image (for double-spend prevention)
 *
 * @param rawTxs - Raw transaction hex strings from step 3
 * @param wallet - Your wallet
 * @returns Array of UTXOs ready to spend
 */
async function step4_ParseTransactions(rawTxs: string[], wallet: VeilWallet): Promise<UTXO[]> {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('STEP 4: PARSE TRANSACTIONS INTO UTXOs');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  if (rawTxs.length === 0) {
    console.log('   No transactions to parse.');
    return [];
  }

  console.log(`   Parsing ${rawTxs.length} transaction(s)...`);

  // Parse all transactions
  const parsedOutputs = await parseWatchOnlyTransactions(
    rawTxs,
    wallet.spendSecret,
    wallet.scanSecret
  );

  console.log(`✅ Successfully parsed ${parsedOutputs.length} UTXO(s)!`);

  // Convert to UTXO format
  const utxos: UTXO[] = parsedOutputs.map(output => ({
    txid: output.txid,
    vout: output.vout,
    amount: output.amount,
    commitment: output.commitment,
    blind: output.blind,
    pubkey: output.pubkey,
    ephemeralPubkey: output.ephemeralPubkey,
    ringctIndex: output.ringctIndex,
    blockHeight: 0, // Not available in watch-only tx
    spendable: true,
  }));

  // Display UTXOs
  for (const utxo of utxos) {
    console.log(`\n   📦 UTXO: ${utxo.txid.slice(0, 16)}...`);
    console.log(`      Amount: ${satoshisToVeil(utxo.amount)} VEIL`);
    console.log(`      Vout: ${utxo.vout}`);
  }

  return utxos;
}

// ===========================================================================
// STEP 5: CHECK WHICH UTXOs ARE SPENT
// ===========================================================================

/**
 * Check which UTXOs have already been spent
 *
 * This prevents double-spending by checking if the key images are on-chain.
 * A key image is a cryptographic proof that uniquely identifies each output.
 *
 * @param utxos - UTXOs from step 4
 * @param parsedOutputs - Original parsed outputs (contains key images)
 * @returns Only unspent UTXOs
 */
async function step5_CheckSpentStatus(
  utxos: UTXO[],
  parsedOutputs: Awaited<ReturnType<typeof parseWatchOnlyTransactions>>
): Promise<UTXO[]> {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('STEP 5: CHECK SPENT STATUS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  if (utxos.length === 0) {
    console.log('   No UTXOs to check.');
    return [];
  }

  console.log(`   Checking ${utxos.length} UTXO(s) for spent status...`);

  // Extract key images
  const keyImages = parsedOutputs.map(output => output.keyImage);

  // If you store locally, which keyimages were spent the last time you call this
  // Filter those out so the light_wallet api, doesn't have to work as hard.

  // Check with blockchain
  const statuses = await RpcRequester.checkKeyImages(keyImages);

  // Filter to unspent only
  const unspent = utxos.filter((utxo, i) => {
    const status = statuses[i];
    const isSpent = status.spent;

    if (isSpent) {
      console.log(`   ⏭️  SPENT: ${utxo.txid.slice(0, 16)}...`);
    }

    return !isSpent;
  });

  // You might want to store this information in your wallets db, for the address.
  // This way when you load your wallet, you don't need to check key images
  // that you know are already spent

  console.log(`\n✅ Found ${unspent.length} unspent UTXO(s)`);
  console.log(`   (${utxos.length - unspent.length} already spent)`);

  return unspent;
}

// ===========================================================================
// STEP 6: GET TOTAL BALANCE
// ===========================================================================

/**
 * Calculate total balance from unspent UTXOs
 *
 * @param utxos - Unspent UTXOs from step 5
 * @returns Balance in satoshis
 */
function step6_GetBalance(utxos: UTXO[]): bigint {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('STEP 6: GET BALANCE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const total = utxos.reduce((sum, utxo) => sum + utxo.amount, 0n);

  console.log(`✅ Total Balance: ${satoshisToVeil(total)} VEIL`);
  console.log(`   UTXOs: ${utxos.length}`);

  return total;
}

// ===========================================================================
// STEP 7: SEND VEIL (The Main Event!)
// ===========================================================================

/**
 * Send VEIL to a recipient address
 *
 * This is the high-level "send()" method that handles everything:
 * ✅ Validates recipient address
 * ✅ Fetches decoy outputs automatically
 * ✅ Selects inputs via coin selection
 * ✅ Builds RingCT transaction
 * ✅ Generates MLSAG signatures
 * ✅ Calculates fees
 * ✅ Creates change output
 *
 * @param wallet - Your wallet
 * @param utxos - Unspent UTXOs from step 5
 * @param recipientAddress - Recipient's stealth address (sv1...)
 * @param amount - Amount to send in satoshis
 */
async function step7_SendVeil(
  wallet: VeilWallet,
  utxos: UTXO[],
  recipientAddress: string,
  amount: bigint
): Promise<void> {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('STEP 7: SEND VEIL');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // CRITICAL: Always validate address first!
  console.log(`   Validating recipient address...`);
  const validation = validateAddress(recipientAddress);

  if (!validation.valid) {
    console.log('❌ Invalid recipient address!');
    console.log(`   Error: ${validation.error}`);
    console.log('\n   Tip: Valid addresses start with "sv1"');
    return;
  }

  console.log(`✅ Address is valid!`);
  console.log(`   Recipient: ${recipientAddress.slice(0, 30)}...`);
  console.log(`   Amount: ${satoshisToVeil(amount)} VEIL`);

  // Initialize transaction builder
  const builder = new TransactionBuilder({
    ringSize: 11,        // Standard ring size for privacy
    feePerKb: 10000,     // Fee rate (satoshis per KB)
  });

  await builder.initialize();

  // Check wallet health
  console.log('\n   Checking wallet health...');
  const health = builder.getWalletHealth(utxos);
  console.log(`   Status: ${health.status.toUpperCase()}`);
  console.log(`   ${health.message}`);

  if (health.shouldConsolidate) {
    console.log('   💡 Tip: Consider consolidating UTXOs for better performance');
  }

  // Build and send transaction
  console.log('\n   Building transaction...');
  console.log('   (This may take a few seconds - generating MLSAG signatures...)');

  const result = await builder.send(
    wallet.spendSecret,
    wallet.scanSecret,
    [{ address: recipientAddress, amount }],
    utxos
  );

  console.log('');

  if (result.success && result.result) {
    // SUCCESS! Transaction is ready to broadcast
    console.log('✅✅✅ TRANSACTION BUILT SUCCESSFULLY! ✅✅✅');
    console.log('');
    console.log('   📋 Transaction Details:');
    console.log(`      TXID: ${result.result.txid}`);
    console.log(`      Size: ${result.result.size} bytes`);
    console.log(`      Fee: ${satoshisToVeil(result.result.fee)} VEIL`);
    console.log(`      Change: ${satoshisToVeil(result.result.change)} VEIL`);

    if (result.warning) {
      console.log(`\n   ⚠️  ${result.warning}`);
    }

    console.log('\n   📤 To broadcast this transaction:');
    console.log('');
    console.log('   await RpcRequester.sendRawTransaction(result.result.txHex);');
    console.log('');
    console.log('   Transaction is ready! 🚀');

  } else if (result.multiTxRequired && result.plan) {
    // Multiple transactions needed (rare, but possible)
    console.log('⚠️  MULTIPLE TRANSACTIONS REQUIRED');
    console.log('');
    console.log(`   This send requires ${result.plan.transactions.length} transactions`);
    console.log(`   Total fees: ${satoshisToVeil(result.plan.totalFees)} VEIL`);
    console.log('');
    console.log(`   💡 ${result.recommendation}`);
    console.log('');
    console.log('   Tip: Consolidate UTXOs first for single transaction send');

  } else {
    // Error occurred
    console.log('❌ TRANSACTION FAILED');
    console.log('');
    console.log(`   Error: ${result.error}`);
    if (result.recommendation) {
      console.log(`   💡 ${result.recommendation}`);
    }
  }
}

// ===========================================================================
// BONUS: CONSOLIDATE UTXOs
// ===========================================================================

/**
 * Consolidate fragmented UTXOs into fewer, larger UTXOs
 *
 * This is useful when you have many small UTXOs which makes transactions
 * slow and expensive. Consolidation combines them into fewer outputs.
 *
 * @param wallet - Your wallet
 * @param utxos - UTXOs to consolidate
 */
async function bonus_ConsolidateUtxos(wallet: VeilWallet, utxos: UTXO[]): Promise<void> {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('BONUS: CONSOLIDATE UTXOs');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  console.log(`   Consolidating ${utxos.length} UTXOs...`);

  const builder = new TransactionBuilder({
    ringSize: 11,
    feePerKb: 10000,
  });

  await builder.initialize();

  const result = await builder.consolidate(
    wallet.spendSecret,
    wallet.scanSecret,
    utxos
  );

  if (result.success) {
    console.log('✅ Consolidation complete!');
    console.log(`   Before: ${result.before.utxos} UTXOs`);
    console.log(`   After: ${result.after.utxos} UTXOs`);
    console.log(`   Total fees: ${satoshisToVeil(result.totalFees)} VEIL`);
    console.log(`   Transactions: ${result.transactions.length}`);

    console.log('\n   📤 To broadcast these transactions:');
    console.log('');
    console.log('   for (const tx of result.transactions) {');
    console.log('     await RpcRequester.sendRawTransaction(tx.txHex);');
    console.log('     await waitForConfirmation(tx.txid);');
    console.log('   }');
  } else {
    console.log('❌ Consolidation failed:', result.error);
  }
}

// ===========================================================================
// MAIN EXAMPLE: Complete Wallet Flow
// ===========================================================================

async function main() {
  console.log('\n╔===============================================================╗');
  console.log('║   VEIL WALLET INTEGRATION - COMPLETE EXAMPLE                  ║');
  console.log('╚===============================================================╝');
  console.log('\nThis example demonstrates the complete wallet lifecycle.');
  console.log('Follow along to learn how to integrate Veil into your wallet!\n');

  try {
    // Initialize WASM (do this once at app startup)
    console.log('⚙️  Initializing WASM...');
    await initWasm();
    console.log('✅ WASM initialized\n');

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STEP 1: Create or restore wallet
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    const wallet = step1_CreateWallet();

    // Or restore from existing keys:
    // const wallet = step1_RestoreWallet(spendKeyHex, scanKeyHex);

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STEP 2: Import to Veil node (optional but recommended)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    await step2_ImportToNode(wallet, 0);

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STEP 3: Fetch transactions from node
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    const rawTxs = await step3_FetchTransactions(wallet);

    if (rawTxs.length === 0) {
      console.log('\n╔===============================================================╗');
      console.log('║   PAUSED: No transactions found                              ║');
      console.log('╚===============================================================╝');
      console.log(`\n💡 Send VEIL to: ${wallet.stealthAddress}`);
      console.log('   Then run this script again to continue.\n');
      return;
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STEP 4: Parse transactions into UTXOs
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    const parsedOutputs = await parseWatchOnlyTransactions(
      rawTxs,
      wallet.spendSecret,
      wallet.scanSecret
    );

    const utxos: UTXO[] = parsedOutputs.map(output => ({
      txid: output.txid,
      vout: output.vout,
      amount: output.amount,
      commitment: output.commitment,
      blind: output.blind,
      pubkey: output.pubkey,
      ephemeralPubkey: output.ephemeralPubkey,
      ringctIndex: output.ringctIndex,
      blockHeight: 0,
      spendable: true,
    }));

    await step4_ParseTransactions(rawTxs, wallet);

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STEP 5: Check spent status
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    const unspent = await step5_CheckSpentStatus(utxos, parsedOutputs);

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STEP 6: Get balance
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    const balance = step6_GetBalance(unspent);

    if (balance === 0n) {
      console.log('\n⚠️  No unspent balance available.');
      return;
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STEP 7: Send VEIL
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    // For this example, send back to ourselves
    const recipientAddress = wallet.stealthAddress;
    const sendAmount = balance / 2n; // Send 50% of balance

    await step7_SendVeil(wallet, unspent, recipientAddress, sendAmount);

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // BONUS: Consolidate if needed
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    if (unspent.length > 10) {
      await bonus_ConsolidateUtxos(wallet, unspent);
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // COMPLETE!
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    console.log('\n╔===============================================================╗');
    console.log('║   ✅ WALLET INTEGRATION COMPLETE!                            ║');
    console.log('╚===============================================================╝');
    console.log('\nYou now know how to:');
    console.log('  1. ✅ Create/restore wallets');
    console.log('  2. ✅ Import to watch-only wallet');
    console.log('  3. ✅ Fetch transactions');
    console.log('  4. ✅ Parse into UTXOs');
    console.log('  5. ✅ Check spent status');
    console.log('  6. ✅ Get balance');
    console.log('  7. ✅ Send VEIL');
    console.log('\nYou can now integrate Veil into your wallet software! 🎉\n');

  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

// ===========================================================================
// QUICK REFERENCE - Copy/Paste into Your Wallet
// ===========================================================================

/*

WALLET DEVELOPER CHEAT SHEET:

// 1. Initialize (once at startup)
await initWasm();

// 2. Create wallet
const wallet = createWallet();
// Save wallet.spendSecretHex and wallet.scanSecretHex (encrypted!)

// 3. Import to node
await RpcRequester.importLightwalletAddress(
  wallet.scanSecretHex,
  bytesToHex(wallet.spendPubkey),
  0
);

// 4. Fetch transactions
const txResult = await RpcRequester.getWatchOnlyTxes(wallet.scanSecretHex, 0);
const rawTxs = txResult.anon.map((tx: any) => tx.raw);

// 5. Parse UTXOs
const parsed = await parseWatchOnlyTransactions(
  rawTxs,
  wallet.spendSecret,
  wallet.scanSecret
);

// 6. Check spent
const keyImages = parsed.map(p => p.keyImage);
const statuses = await RpcRequester.checkKeyImages(keyImages);
const unspent = parsed.filter((_, i) => !statuses[i].spent);

// 7. Get balance
const balance = unspent.reduce((sum, u) => sum + u.amount, 0n);

// 8. Send VEIL
if (!isValidAddress(recipientAddress)) {
  throw new Error('Invalid address');
}

const builder = new TransactionBuilder({ ringSize: 11, feePerKb: 10000 });
await builder.initialize();

const result = await builder.send(
  wallet.spendSecret,
  wallet.scanSecret,
  [{ address: recipientAddress, amount }],
  unspent
);

if (result.success && result.result) {
  await RpcRequester.sendRawTransaction(result.result.txHex);
}

// That's it! 🚀

*/

// Run the example
main().catch(console.error);
