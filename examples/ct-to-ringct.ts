/**
 * Example: Convert CT Outputs to RingCT
 *
 * Demonstrates how to spend CT (Confidential Transaction) outputs
 * and convert them to RingCT outputs. This is useful for:
 * - Converting legacy CT funds to the more private RingCT format
 * - Consolidating CT UTXOs into RingCT
 *
 * CT outputs use ECDSA signatures with P2PKH scripts, while RingCT
 * outputs use MLSAG ring signatures for enhanced privacy.
 *
 * USAGE:
 * ------
 * Set environment variables with your wallet keys:
 *   SPEND_SECRET=<hex> SCAN_SECRET=<hex> STEALTH_ADDRESS=<addr> npx tsx examples/ct-to-ringct.ts
 *
 * Or modify the script to load keys from a wallet file.
 */

import {
  initWasm,
  getBalanceCT,
  TransactionBuilder,
  satoshisToVeil,
  veilToSatoshis,
  hexToBytes,
  setDebug,
  RpcRequester,
} from '../src';

// Configuration
const SEND_AMOUNT = veilToSatoshis(1); // Amount to send (1 VEIL)
const BROADCAST_TX = true; // Set to false to just build without broadcasting

async function main() {
  console.log('🔄 Veil CT → RingCT Converter\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Get wallet keys from environment variables
  const spendSecretHex = process.env.SPEND_SECRET;
  const scanSecretHex = process.env.SCAN_SECRET;
  const stealthAddress = process.env.STEALTH_ADDRESS;

  if (!spendSecretHex || !scanSecretHex || !stealthAddress) {
    console.error('❌ Error: Missing required environment variables\n');
    console.error('Usage:');
    console.error('  SPEND_SECRET=<hex> SCAN_SECRET=<hex> STEALTH_ADDRESS=<addr> npx tsx examples/ct-to-ringct.ts\n');
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
  const ctResult = await getBalanceCT(spendSecret, scanSecret);

  console.log(`   💰 CT Balance: ${satoshisToVeil(ctResult.totalBalance)} VEIL`);
  console.log(`   📦 CT UTXOs: ${ctResult.utxos.length}\n`);

  if (ctResult.utxos.length === 0) {
    console.log('⚠️  No CT UTXOs found. Nothing to convert.\n');
    return;
  }

  // Build CT → RingCT transaction
  console.log('3️⃣  Building CT → RingCT transaction...');

  const txBuilder = new TransactionBuilder();
  await txBuilder.initialize();

  try {
    const result = await txBuilder.sendStealthToRingCT(
      spendSecret,
      scanSecret,
      [{
        address: stealthAddress,
        amount: SEND_AMOUNT
      }],
      ctResult.utxos
    );

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ TRANSACTION BUILT');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log(`   📝 TXID:     ${result.txid}`);
    console.log(`   📦 Size:     ${result.size} bytes`);
    console.log(`   💸 Fee:      ${satoshisToVeil(result.fee)} VEIL`);
    console.log(`   🔄 Change:   ${satoshisToVeil(result.change)} VEIL`);
    console.log(`   ⬅️  Inputs:   ${result.inputs.length} CT`);
    console.log(`   ➡️  Outputs:  ${result.outputs.length} RingCT\n`);

    // Broadcast transaction
    if (BROADCAST_TX) {
      console.log('4️⃣  Broadcasting transaction...');

      try {
        const txid = await RpcRequester.sendRawTransaction(result.txHex);
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🎉 BROADCAST SUCCESSFUL');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        console.log(`   📝 TXID: ${txid}\n`);
      } catch (broadcastError: any) {
        console.error('\n❌ Broadcast failed:', broadcastError.message);
        console.log('\n   Raw TX hex saved for manual broadcast.');
      }
    } else {
      console.log('ℹ️  BROADCAST_TX is false, skipping broadcast.\n');
    }

    // Save raw hex for debugging/manual broadcast
    const fs = await import('fs');
    const hexPath = 'ct-to-ringct-tx.hex';
    fs.writeFileSync(hexPath, result.txHex);
    console.log(`   💾 Raw TX saved to: ${hexPath}\n`);

  } catch (error: any) {
    console.error('\n❌ Error building transaction:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
