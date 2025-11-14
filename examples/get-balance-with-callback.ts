/**
 * Example: Get Balance with Streaming Callback
 *
 * Demonstrates using the onUtxoDiscovered callback to process UTXOs
 * as they are discovered, useful for large wallets or real-time UI updates.
 *
 * PREREQUISITE:
 * -------------
 * This example requires test-wallet.json to exist.
 */

import {
  initWasm,
  getBalance,
  satoshisToVeil,
  hexToBytes,
  type ParsedUTXO,
} from '../src';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  console.log('💰 Veil Get Balance with Callback Example\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Initialize WASM
  console.log('1️⃣  Initializing WASM...');
  await initWasm();
  console.log('✅ WASM initialized\n');

  // Load wallet
  console.log('2️⃣  Loading wallet from test-wallet.json...');
  const walletPath = path.join(__dirname, '../test-wallet.json');

  if (!fs.existsSync(walletPath)) {
    console.error('❌ Error: test-wallet.json not found!');
    console.error('   Please run end-to-end-test.ts first to create the wallet.\n');
    return;
  }

  const wallet = JSON.parse(fs.readFileSync(walletPath, 'utf8'));
  const scanSecret = hexToBytes(wallet.scanSecret);
  const spendSecret = hexToBytes(wallet.spendSecret);

  console.log('📧 Address:', wallet.stealthAddress);
  console.log('');

  // Track discovered UTXOs via callback
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('3️⃣  Scanning blockchain with callback...');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  let batchCount = 0;
  let runningTotal = 0n;
  const discoveredUtxos: ParsedUTXO[] = [];

  // Callback function that's called once with a batch of unspent UTXOs
  const onUtxoDiscovered = async (utxos: ParsedUTXO[]) => {
    batchCount++;

    console.log(`📦 Batch #${batchCount}: Discovered ${utxos.length} unspent UTXO(s)`);
    console.log('');

    // Process each UTXO in the batch
    for (const utxo of utxos) {
      runningTotal += utxo.amount;
      discoveredUtxos.push(utxo);

      console.log(`   ${discoveredUtxos.length}. ${satoshisToVeil(utxo.amount)} VEIL`);
      console.log(`      TXID: ${utxo.txid.slice(0, 16)}...`);
      console.log(`      Vout: ${utxo.vout}`);
    }

    console.log(`   Batch Total: ${satoshisToVeil(runningTotal)} VEIL`);
    console.log('');

    // Simulate async processing (e.g., updating UI, saving to DB)
    await new Promise(resolve => setTimeout(resolve, 10));
  };

  const startTime = Date.now();

  // Call getBalance with callback
  const result = await getBalance(spendSecret, scanSecret, undefined, {
    onUtxoDiscovered,
  });

  const duration = Date.now() - startTime;

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('4️⃣  Final Results');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('📊 Summary:');
  console.log(`   Total Balance: ${satoshisToVeil(result.totalBalance)} VEIL`);
  console.log(`   Unspent UTXOs: ${result.utxos.length}`);
  console.log(`   Outputs Scanned: ${result.totalOutputsScanned}`);
  console.log(`   Owned Outputs Found: ${result.ownedOutputsFound}`);
  console.log(`   Duration: ${duration}ms`);
  console.log('');

  console.log('🔍 Callback Stats:');
  console.log(`   Batches processed: ${batchCount}`);
  console.log(`   Total UTXOs discovered: ${discoveredUtxos.length}`);
  console.log(`   Running total: ${satoshisToVeil(runningTotal)} VEIL`);
  console.log('');

  // Verification
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('5️⃣  Verification');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const utxoCountMatch = discoveredUtxos.length === result.utxos.length;
  const balanceMatch = runningTotal === result.totalBalance;

  console.log('✅ Callback UTXO count matches result:', utxoCountMatch ? 'YES' : 'NO');
  console.log(`   Callback: ${discoveredUtxos.length}`);
  console.log(`   Result: ${result.utxos.length}`);
  console.log('');

  console.log('✅ Running total matches final balance:', balanceMatch ? 'YES' : 'NO');
  console.log(`   Callback total: ${satoshisToVeil(runningTotal)} VEIL`);
  console.log(`   Final balance: ${satoshisToVeil(result.totalBalance)} VEIL`);
  console.log('');

  if (utxoCountMatch && balanceMatch) {
    console.log('🎉 All verifications passed! Callback working correctly.\n');
  } else {
    console.log('❌ Verification failed! Something is wrong with the callback.\n');
  }

  // Show use cases
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('💡 Callback Use Cases');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('   1. Real-time UI updates as unspent UTXOs are discovered');
  console.log('   2. Incremental database updates for large wallets');
  console.log('   3. Progress indicators during balance calculation');
  console.log('   4. Efficient batch processing without per-UTXO overhead');
  console.log('   5. Stream processing for wallets with many UTXOs');
  console.log('');

  console.log('✅ Example complete!\n');
}

main().catch(console.error);
