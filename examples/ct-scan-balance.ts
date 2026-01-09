/**
 * Example: Scan for CT (Confidential Transaction) Balance
 *
 * Demonstrates how to scan for CT outputs belonging to a wallet.
 * CT outputs are a type of stealth output that use P2PKH scripts
 * instead of RingCT's destination pubkeys.
 *
 * USAGE:
 * ------
 * Set environment variables with your wallet keys:
 *   SPEND_SECRET=<hex> SCAN_SECRET=<hex> npx tsx examples/ct-scan-balance.ts
 *
 * Or modify the script to load keys from a wallet file.
 */

import {
  initWasm,
  getBalanceCT,
  satoshisToVeil,
  hexToBytes,
  setDebug,
} from '../src';

async function main() {
  console.log('🔍 Veil CT Balance Scanner\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Get wallet keys from environment variables
  const spendSecretHex = process.env.SPEND_SECRET;
  const scanSecretHex = process.env.SCAN_SECRET;

  if (!spendSecretHex || !scanSecretHex) {
    console.error('❌ Error: Missing required environment variables\n');
    console.error('Usage:');
    console.error('  SPEND_SECRET=<hex> SCAN_SECRET=<hex> npx tsx examples/ct-scan-balance.ts\n');
    process.exit(1);
  }

  const spendSecret = hexToBytes(spendSecretHex);
  const scanSecret = hexToBytes(scanSecretHex);

  // Enable debug logging (optional)
  // setDebug(true);

  // Initialize WASM
  console.log('1️⃣  Initializing WASM...');
  await initWasm();
  console.log('✅ WASM initialized\n');

  // Scan for CT outputs
  console.log('2️⃣  Scanning for CT outputs...');
  console.log('   This may take a moment...\n');

  try {
    const result = await getBalanceCT(spendSecret, scanSecret);

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 RESULTS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log(`💰 CT Balance:          ${satoshisToVeil(result.totalBalance)} VEIL`);
    console.log(`📦 CT UTXOs found:      ${result.utxos.length}`);
    console.log(`🔎 Outputs scanned:     ${result.totalOutputsScanned}`);
    console.log(`✅ Owned outputs:       ${result.ownedOutputsFound}\n`);

    if (result.utxos.length > 0) {
      console.log('📋 UTXO Details:');
      console.log('─────────────────────────────────────────');
      for (const utxo of result.utxos) {
        console.log(`\n  📍 ${utxo.txid}:${utxo.vout}`);
        console.log(`     Amount: ${satoshisToVeil(utxo.amount)} VEIL`);
      }
      console.log('\n');
    }

    console.log('✅ Scan complete!\n');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
