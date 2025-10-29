/**
 * Example 4: Scan for Received Outputs
 *
 * Fetches transactions from the blockchain and scans for owned outputs.
 *
 * PREREQUISITE:
 * -------------
 * This example requires test-wallet.json to exist.
 * Run end-to-end-test.ts first to create the wallet file, or:
 * - Copy test-wallet.json.example to test-wallet.json
 */

import {
  initWasm,
  scanTransaction,
  bytesToHex,
  hexToBytes,
  satoshisToVeil,
} from '../src';
import { RpcRequester } from '../src/rpc';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  console.log('🔍 Veil Output Scanning Example\n');

  // Initialize WASM
  console.log('1️⃣  Initializing WASM...');
  await initWasm();
  console.log('✅ WASM initialized\n');

  // Load wallet
  console.log('2️⃣  Loading wallet...');
  const walletPath = path.join(__dirname, '../test-wallet.json');
  const wallet = JSON.parse(fs.readFileSync(walletPath, 'utf8'));

  const scanSecret = hexToBytes(wallet.scanSecret);
  const spendPubkey = hexToBytes(wallet.spendPubkey);

  console.log('📧 Address:', wallet.stealthAddress);
  console.log('');

  // Fetch transactions
  console.log('3️⃣  Fetching transactions from blockchain...');
  const txResult = await RpcRequester.getWatchOnlyTxes(wallet.scanSecret, 0);

  if (!txResult || !txResult.anon || txResult.anon.length === 0) {
    console.log('  ⚠️  No RingCT transactions found');
    console.log(`  Send VEIL to: ${wallet.stealthAddress}`);
    return;
  }

  console.log(`  ✅ Fetched ${txResult.anon.length} RingCT transaction(s)`);
  console.log('');

  // Parse raw transaction data
  console.log('4️⃣  Parsing and scanning outputs...');
  console.log('');

  const { parseWatchOnlyTransactions } = await import('../src/watch-only-tx');
  const spendSecret = hexToBytes(wallet.spendSecret);
  const rawTxs = txResult.anon.map((tx: any) => tx.raw);

  const utxos = await parseWatchOnlyTransactions(
    rawTxs,
    spendSecret,
    scanSecret
  );

  console.log(`  ✅ Found ${utxos.length} owned outputs!`);
  console.log('');

  // Check spent status using bulk key image check
  console.log('5️⃣  Checking spent status...');
  const keyImages = utxos.map(utxo => utxo.keyImage);
  const spentStatuses = await RpcRequester.checkKeyImages(keyImages);
  console.log('');

  // Display each UTXO with spent status
  let spentCount = 0;
  let unspentCount = 0;
  let spentBalance = 0n;
  let unspentBalance = 0n;

  utxos.forEach((utxo, i) => {
    const spent = spentStatuses[i].spent;
    const status = spent ? '❌ SPENT' : '✅ UNSPENT';

    if (spent) {
      spentCount++;
      spentBalance += utxo.amount;
    } else {
      unspentCount++;
      unspentBalance += utxo.amount;
    }

    console.log(`  ${i + 1}. ${satoshisToVeil(utxo.amount)} VEIL - ${status}`);
    console.log(`     TXID: ${utxo.txid.slice(0, 16)}...`);
    console.log(`     Vout: ${utxo.vout}`);
    console.log(`     RingCT Index: ${utxo.ringctIndex}`);
    console.log('');
  });

  // Summary
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 Summary');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  Transactions scanned: ${txResult.anon.length}`);
  console.log(`  Owned outputs found: ${utxos.length}`);
  console.log('');
  console.log(`  ✅ Unspent: ${unspentCount} (${satoshisToVeil(unspentBalance)} VEIL)`);
  console.log(`  ❌ Spent:   ${spentCount} (${satoshisToVeil(spentBalance)} VEIL)`);
  console.log('');

  const totalBalance = utxos.reduce((sum, u) => sum + u.amount, 0n);
  console.log(`💰 Total Balance (All): ${satoshisToVeil(totalBalance)} VEIL`);
  console.log(`💵 Spendable Balance:   ${satoshisToVeil(unspentBalance)} VEIL`);
  console.log('');

  console.log('✅ Scanning complete!');
  console.log('');
}

main().catch(console.error);
