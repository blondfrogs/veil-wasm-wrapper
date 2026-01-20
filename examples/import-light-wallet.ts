/**
 * Example: Import stealth address to light wallet and scan for outputs
 *
 * This script demonstrates how to:
 * 1. Import a stealth address to the Veil node's light wallet
 * 2. Check sync status
 * 3. Scan for received outputs
 * 4. Save outputs to a wallet file
 *
 * USAGE:
 * Set your wallet credentials below and run:
 * npx ts-node examples/import-light-wallet.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  initWasm,
  RpcRequester,
  parseWatchOnlyTransactions,
  bytesToHex,
  hexToBytes,
  satoshisToVeil,
} from '../src';

// ============================================================================
// CONFIGURATION - Replace with your wallet credentials
// ============================================================================

// Your stealth address
const STEALTH_ADDRESS = 'sv1qqpasaj0gm7w8uvv2mth6g6f07sunaxauq7rqt204qyepygeg7ldngspqdukleulgk23f7pnl40x2gsnr7lrxx2tmtpk2dcwnf2ss0vayhxayqqqujhpw2';

// Your keys in HEX format
// Converted from WIF using: npx ts-node examples/wif-to-hex.ts
const SCAN_SECRET_HEX = '0191255dba29f77618320ba270561552f3248ace2cd23d5f4c2e776a6f4fa95c';
const SPEND_SECRET_HEX = 'fc7271b84fe346d0d5102452d7df7e9548b845387338c1c7e2009ab6cd8ab7bf';
const SPEND_PUBLIC_HEX = '03796fe79f459514f833fd5e6522131fbe33194bdac365370e9a55083d9d25cdd2';

// Output wallet file
const WALLET_FILE = path.join(__dirname, '../imported-wallet.json');

// ============================================================================
// Wallet file structure
// ============================================================================

interface StoredRingCTOutput {
  txid: string;
  vout: number;
  amount: string;
  commitment: string;
  blind: string;
  pubkey: string;
  ephemeralPubkey: string;
  keyImage: string;
  ringctIndex?: number;
  blockHeight?: number;
  spent?: boolean;
}

interface ImportedWallet {
  scanSecret: string;
  spendSecret: string;
  spendPubkey: string;
  stealthAddress: string;
  receivedOutputs: StoredRingCTOutput[];
  importedAt: number;
  lastScanAt?: number;
}

// ============================================================================
// Main function
// ============================================================================

async function main() {
  console.log('🔐 Veil Light Wallet Import & Scan');
  console.log('===================================');
  console.log('');

  // Initialize WASM
  console.log('⚙️  Initializing WASM...');
  await initWasm();
  console.log('✅ WASM initialized');
  console.log('');

  console.log('📋 Wallet Configuration:');
  console.log('   Address:', STEALTH_ADDRESS);
  console.log('   Scan Secret:', SCAN_SECRET_HEX.slice(0, 16) + '...');
  console.log('   Spend Public:', SPEND_PUBLIC_HEX);
  console.log('');

  // Step 1: Import address to light wallet
  await importAddressToLightWallet();

  // Step 2: Check sync status
  const syncStatus = await checkSyncStatus();

  // Step 3: If synced, scan for outputs
  if (syncStatus === 'synced') {
    await scanForOutputs();
  } else {
    console.log('⏸️  Waiting for sync to complete...');
    console.log('   Run this script again later to scan for outputs.');
    console.log('');
  }

  // Step 4: Save wallet file
  await saveWalletFile();

  console.log('===================================');
  console.log('✅ Complete!');
  console.log('');
  console.log('Next steps:');
  console.log('1. Send VEIL to:', STEALTH_ADDRESS);
  console.log('2. Wait for transaction to confirm');
  console.log('3. Run this script again to scan for outputs');
  console.log('');
}

// ============================================================================
// Step 1: Import address to light wallet
// ============================================================================

async function importAddressToLightWallet() {
  console.log('📥 Step 1: Importing address to light wallet...');
  console.log('');

  // Scan from genesis block to catch all historical transactions
  const fromBlock = 0;

  try {
    const importResult = await RpcRequester.importLightwalletAddress(
      SCAN_SECRET_HEX,
      SPEND_PUBLIC_HEX,
      fromBlock
    );

    if (importResult.error) {
      if (importResult.error.message.includes('already imported')) {
        console.log('   ℹ️  Address already imported');
      } else {
        console.log('   ⚠️  Import error:', importResult.error.message);
      }
    } else {
      console.log('   ✅ Address imported successfully!');
      if (importResult.result?.stealth_address_bech) {
        console.log('   Stealth Address:', importResult.result.stealth_address_bech);
      }
    }
    console.log('');

  } catch (error: any) {
    console.log('   ❌ Could not connect to light wallet API');
    console.log('   Error:', error.message);
    console.log('');
    console.log('   Requirements:');
    console.log('   - Run a local Veil node with -lightwalletserver enabled');
    console.log('   - Or connect to a node that supports light wallet RPC');
    console.log('');
    console.log('   Public explorer APIs typically do not support light wallet features.');
    console.log('');
  }
}

// ============================================================================
// Step 2: Check sync status
// ============================================================================

async function checkSyncStatus(): Promise<string | null> {
  console.log('🔍 Step 2: Checking sync status...');
  console.log('');

  try {
    const status = await RpcRequester.getWatchOnlyStatus(
      SCAN_SECRET_HEX,
      SPEND_PUBLIC_HEX
    );

    if (status && status.status) {
      console.log('   Status:', status.status);

      if (status.synced_height !== undefined) {
        console.log('   Synced Height:', status.synced_height);
      }
      if (status.current_height !== undefined) {
        console.log('   Current Height:', status.current_height);
      }
      console.log('');

      return status.status;
    } else {
      console.log('   ⚠️  Could not retrieve sync status');
      console.log('');
      return null;
    }

  } catch (error: any) {
    console.log('   ❌ Error:', error.message);
    console.log('');
    return null;
  }
}

// ============================================================================
// Step 3: Scan for outputs
// ============================================================================

async function scanForOutputs() {
  console.log('🔍 Step 3: Scanning for received outputs...');
  console.log('');

  const spendSecret = hexToBytes(SPEND_SECRET_HEX);
  const scanSecret = hexToBytes(SCAN_SECRET_HEX);

  try {
    // Fetch transactions from light wallet API
    const txResult = await RpcRequester.getWatchOnlyTxes(SCAN_SECRET_HEX, 0);

    if (!txResult || !txResult.anon || txResult.anon.length === 0) {
      console.log('   ℹ️  No RingCT transactions found');
      console.log('');
      return [];
    }

    console.log(`   ✅ Found ${txResult.anon.length} RingCT transaction(s)`);
    console.log('');

    // Parse transactions
    const rawTxs = txResult.anon.map((tx: any) => tx.raw);
    const txMetadata = txResult.anon.map((tx: any) => ({
      amount: tx.amount,
      blind: tx.blind,
      ...tx
    }));

    const parsedOutputs = await parseWatchOnlyTransactions(
      rawTxs,
      spendSecret,
      scanSecret,
      txMetadata
    );

    console.log(`   ✅ Parsed ${parsedOutputs.length} output(s)`);
    console.log('');

    // Check spent status
    const keyImages = parsedOutputs.map(output => output.keyImage);
    const spentStatuses = await RpcRequester.checkKeyImages(keyImages);

    // Display outputs
    let totalAmount = 0n;
    let unspentCount = 0;

    for (let i = 0; i < parsedOutputs.length; i++) {
      const output = parsedOutputs[i];
      const isSpent = spentStatuses[i].spent;

      console.log('   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`   📦 RingCT UTXO #${i + 1} ${isSpent ? '(SPENT)' : '(UNSPENT)'}`);
      console.log('   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('   TXID:', output.txid);
      console.log('   Vout:', output.vout);
      console.log('   Amount:', satoshisToVeil(output.amount), 'VEIL');
      console.log('   RingCT Index:', output.ringctIndex || 'N/A');
      console.log('   Status:', isSpent ? 'Spent' : 'Unspent');
      console.log('');

      if (!isSpent) {
        totalAmount += output.amount;
        unspentCount++;
      }
    }

    console.log('   📊 Summary:');
    console.log(`   Total outputs: ${parsedOutputs.length}`);
    console.log(`   Unspent: ${unspentCount}`);
    console.log(`   Spent: ${parsedOutputs.length - unspentCount}`);
    console.log(`   Spendable balance: ${satoshisToVeil(totalAmount)} VEIL`);
    console.log('');

    // Save outputs to wallet file
    await saveOutputsToWallet(parsedOutputs, spentStatuses);

    return parsedOutputs;

  } catch (error: any) {
    console.log('   ❌ Error scanning:', error.message);
    console.log('');
    return [];
  }
}

// ============================================================================
// Save outputs to wallet file
// ============================================================================

async function saveOutputsToWallet(parsedOutputs: any[], spentStatuses: any[]) {
  const wallet: ImportedWallet = {
    scanSecret: SCAN_SECRET_HEX,
    spendSecret: SPEND_SECRET_HEX,
    spendPubkey: SPEND_PUBLIC_HEX,
    stealthAddress: STEALTH_ADDRESS,
    receivedOutputs: parsedOutputs.map((output, idx) => ({
      txid: output.txid,
      vout: output.vout,
      amount: output.amount.toString(),
      commitment: bytesToHex(output.commitment),
      blind: bytesToHex(output.blind),
      pubkey: bytesToHex(output.pubkey),
      ephemeralPubkey: bytesToHex(output.ephemeralPubkey),
      keyImage: bytesToHex(output.keyImage),
      ringctIndex: output.ringctIndex,
      blockHeight: 0,
      spent: spentStatuses[idx].spent,
    })),
    importedAt: Date.now(),
    lastScanAt: Date.now(),
  };

  fs.writeFileSync(WALLET_FILE, JSON.stringify(wallet, null, 2));
  console.log('   ✅ Saved outputs to:', WALLET_FILE);
  console.log('');
}

// ============================================================================
// Save wallet file (even if no outputs yet)
// ============================================================================

async function saveWalletFile() {
  if (!fs.existsSync(WALLET_FILE)) {
    console.log('💾 Saving wallet credentials...');

    const wallet: ImportedWallet = {
      scanSecret: SCAN_SECRET_HEX,
      spendSecret: SPEND_SECRET_HEX,
      spendPubkey: SPEND_PUBLIC_HEX,
      stealthAddress: STEALTH_ADDRESS,
      receivedOutputs: [],
      importedAt: Date.now(),
    };

    fs.writeFileSync(WALLET_FILE, JSON.stringify(wallet, null, 2));
    console.log('   ✅ Wallet saved to:', WALLET_FILE);
    console.log('');
  }
}

// ============================================================================
// Run
// ============================================================================

main().catch((error) => {
  console.error('❌ Fatal error:', error.message);
  console.error(error);
  process.exit(1);
});
