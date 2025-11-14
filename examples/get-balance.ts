/**
 * Example: Get Wallet Balance
 *
 * Demonstrates the getBalance function with and without caching.
 * Shows how to use knownSpentKeyImages to optimize repeated calls.
 *
 * PREREQUISITE:
 * -------------
 * This example requires test-wallet.json to exist.
 * Run end-to-end-test.ts first to create the wallet file, or:
 * - Copy test-wallet.json.example to test-wallet.json
 */

import {
  initWasm,
  getBalance,
  satoshisToVeil,
  hexToBytes,
} from '../src';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  console.log('💰 Veil Get Balance Example\n');
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

  // Test 1: Get balance WITHOUT caching (fresh scan)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('3️⃣  TEST 1: Get balance WITHOUT known key images');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const startTime1 = Date.now();
  const result1 = await getBalance(spendSecret, scanSecret);
  const duration1 = Date.now() - startTime1;

  console.log('📊 Results:');
  console.log(`   Total Balance: ${satoshisToVeil(result1.totalBalance)} VEIL`);
  console.log(`   Unspent UTXOs: ${result1.utxos.length}`);
  console.log(`   Outputs Scanned: ${result1.totalOutputsScanned}`);
  console.log(`   Owned Outputs Found: ${result1.ownedOutputsFound}`);
  console.log(`   Spent Key Images: ${result1.spentKeyImages.length}`);
  console.log(`   Last Processed Index: ${result1.lastProcessedIndex}`);
  console.log(`   ⏱️  Duration: ${duration1}ms\n`);

  // Display UTXOs
  if (result1.utxos.length > 0) {
    console.log('💵 Unspent UTXOs:');
    result1.utxos.forEach((utxo, i) => {
      console.log(`   ${i + 1}. ${satoshisToVeil(utxo.amount)} VEIL`);
      console.log(`      TXID: ${utxo.txid.slice(0, 16)}...`);
      console.log(`      Vout: ${utxo.vout}`);
      console.log(`      RingCT Index: ${utxo.ringctIndex || 'N/A'}`);
    });
    console.log('');
  }

  // Test 2: Get balance WITH caching (using known spent key images)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('4️⃣  TEST 2: Get balance WITH known key images (cached)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log(`   Using ${result1.spentKeyImages.length} cached spent key images from TEST 1...`);
  console.log('');

  const startTime2 = Date.now();
  const result2 = await getBalance(spendSecret, scanSecret, undefined, {
    knownSpentKeyImages: result1.spentKeyImages,
    startIndex: 0, // Start from beginning to ensure we get same results
  });
  const duration2 = Date.now() - startTime2;

  console.log('📊 Results:');
  console.log(`   Total Balance: ${satoshisToVeil(result2.totalBalance)} VEIL`);
  console.log(`   Unspent UTXOs: ${result2.utxos.length}`);
  console.log(`   Outputs Scanned: ${result2.totalOutputsScanned}`);
  console.log(`   Owned Outputs Found: ${result2.ownedOutputsFound}`);
  console.log(`   Spent Key Images: ${result2.spentKeyImages.length}`);
  console.log(`   Last Processed Index: ${result2.lastProcessedIndex}`);
  console.log(`   ⏱️  Duration: ${duration2}ms\n`);

  // Test 3: Use receivedOutputs from wallet file to pre-populate known spent key images
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('5️⃣  TEST 3: Using receivedOutputs from wallet file');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const knownSpentFromWallet: string[] = [];
  if (wallet.receivedOutputs && Array.isArray(wallet.receivedOutputs)) {
    wallet.receivedOutputs.forEach((output: any) => {
      if (output.spent && output.keyImage) {
        knownSpentFromWallet.push(output.keyImage);
      }
    });
  }

  console.log(`   Found ${knownSpentFromWallet.length} spent key images in receivedOutputs...`);
  console.log('');

  const startTime3 = Date.now();
  const result3 = await getBalance(spendSecret, scanSecret, undefined, {
    knownSpentKeyImages: knownSpentFromWallet,
  });
  const duration3 = Date.now() - startTime3;

  console.log('📊 Results:');
  console.log(`   Total Balance: ${satoshisToVeil(result3.totalBalance)} VEIL`);
  console.log(`   Unspent UTXOs: ${result3.utxos.length}`);
  console.log(`   Outputs Scanned: ${result3.totalOutputsScanned}`);
  console.log(`   Owned Outputs Found: ${result3.ownedOutputsFound}`);
  console.log(`   Spent Key Images: ${result3.spentKeyImages.length}`);
  console.log(`   Last Processed Index: ${result3.lastProcessedIndex}`);
  console.log(`   ⏱️  Duration: ${duration3}ms\n`);

  // Verification: Compare results
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('6️⃣  VERIFICATION: Comparing Results');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const balancesMatch = result1.totalBalance === result2.totalBalance &&
                        result2.totalBalance === result3.totalBalance;
  const utxoCountsMatch = result1.utxos.length === result2.utxos.length &&
                          result2.utxos.length === result3.utxos.length;

  console.log('🔍 Consistency Check:');
  console.log(`   Balances Match: ${balancesMatch ? '✅ YES' : '❌ NO'}`);
  console.log(`     TEST 1: ${satoshisToVeil(result1.totalBalance)} VEIL`);
  console.log(`     TEST 2: ${satoshisToVeil(result2.totalBalance)} VEIL`);
  console.log(`     TEST 3: ${satoshisToVeil(result3.totalBalance)} VEIL`);
  console.log('');
  console.log(`   UTXO Counts Match: ${utxoCountsMatch ? '✅ YES' : '❌ NO'}`);
  console.log(`     TEST 1: ${result1.utxos.length} UTXOs`);
  console.log(`     TEST 2: ${result2.utxos.length} UTXOs`);
  console.log(`     TEST 3: ${result3.utxos.length} UTXOs`);
  console.log('');

  console.log('⏱️  Performance Comparison:');
  console.log(`   TEST 1 (no cache):           ${duration1}ms`);
  console.log(`   TEST 2 (cached spent):       ${duration2}ms`);
  console.log(`   TEST 3 (wallet file cache):  ${duration3}ms`);

  if (duration2 < duration1) {
    const improvement = ((duration1 - duration2) / duration1 * 100).toFixed(1);
    console.log(`   🚀 Cache improvement: ${improvement}% faster`);
  }
  console.log('');

  if (balancesMatch && utxoCountsMatch) {
    console.log('✅ All tests passed! Results are consistent.\n');
  } else {
    console.log('❌ Warning: Results do not match!\n');
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('💡 Usage Tips:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('   1. Cache spentKeyImages between calls to avoid redundant RPC checks');
  console.log('   2. Use startIndex to resume scanning from last position');
  console.log('   3. Store balance state in wallet file for persistence');
  console.log('   4. Re-run periodically to detect new incoming transactions\n');

  console.log('✅ Example complete!\n');
}

main().catch(console.error);
