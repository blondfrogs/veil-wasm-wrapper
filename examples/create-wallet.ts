/**
 * Example 16: Create Wallet (The Simplest Way!)
 *
 * Shows how incredibly simple it is to create a Veil wallet.
 * Just one function call - no complex setup required!
 */

import { createWallet, restoreWallet, initWasm } from '../src';

// ============================================================================
// Example 1: Create a New Wallet (ONE LINE!)
// ============================================================================

function createNewWallet() {
  console.log('\n🆕 Create a New Wallet');
  console.log('='.repeat(60));

  // That's it! Just one function call:
  const wallet = createWallet();

  console.log('✅ Wallet created!\n');
  console.log('📬 Your Address:');
  console.log(`   ${wallet.stealthAddress}`);
  console.log('\n🔑 Your Private Keys (BACK THESE UP!):');
  console.log(`   Spend Key: ${wallet.spendSecretHex}`);
  console.log(`   Scan Key:  ${wallet.scanSecretHex}`);
  console.log('\n💡 Tips:');
  console.log('   • Share your address to receive VEIL');
  console.log('   • NEVER share your private keys!');
  console.log('   • Back up your keys in a safe place');

  return wallet;
}

// ============================================================================
// Example 2: Restore Wallet from Keys
// ============================================================================

function restoreExistingWallet() {
  console.log('\n🔄 Restore Wallet from Keys');
  console.log('='.repeat(60));

  // Example keys (replace with real user keys)
  const spendKey = '0000000000000000000000000000000000000000000000000000000000000001';
  const scanKey = '0000000000000000000000000000000000000000000000000000000000000002';

  // Restore from hex strings
  const wallet = restoreWallet(spendKey, scanKey);

  console.log('✅ Wallet restored!\n');
  console.log('📬 Address:', wallet.stealthAddress);

  return wallet;
}

// ============================================================================
// Example 3: Save & Load Wallet (Simple Storage)
// ============================================================================

function saveWallet(wallet: any) {
  console.log('\n💾 Save Wallet');
  console.log('='.repeat(60));

  // In a real wallet, encrypt this before saving!
  const walletData = {
    address: wallet.stealthAddress,
    spendKey: wallet.spendSecretHex,
    scanKey: wallet.scanSecretHex,
  };

  // Save to file, database, or encrypted storage
  // fs.writeFileSync('wallet.json', JSON.stringify(walletData));
  console.log('Wallet data (encrypt before saving!):');
  console.log(JSON.stringify(walletData, null, 2));
}

function loadWallet() {
  console.log('\n📂 Load Wallet');
  console.log('='.repeat(60));

  // Load from file/database
  // const walletData = JSON.parse(fs.readFileSync('wallet.json', 'utf8'));

  // Example loaded data
  const walletData = {
    address: 'sv1...',
    spendKey: '1234...',
    scanKey: '5678...',
  };

  // Restore wallet
  const wallet = restoreWallet(walletData.spendKey, walletData.scanKey);

  console.log('✅ Wallet loaded!');
  console.log('📬 Address:', wallet.stealthAddress);

  return wallet;
}

// ============================================================================
// Example 4: Complete Wallet Flow
// ============================================================================

function completeWalletFlow() {
  console.log('\n💰 Complete Wallet Flow');
  console.log('='.repeat(60));

  // Step 1: Check if wallet exists
  const hasWallet = false; // Check if user has saved wallet

  let wallet;

  if (hasWallet) {
    console.log('\n📂 Loading existing wallet...');
    wallet = loadWallet();
  } else {
    console.log('\n🆕 Creating new wallet...');
    wallet = createWallet();
    console.log('\n✅ New wallet created!');
    console.log(`📬 Address: ${wallet.stealthAddress}`);
    console.log('\n💾 Don\'t forget to back up your keys!');

    // Save wallet (encrypted!)
    saveWallet(wallet);
  }

  return wallet;
}

// ============================================================================
// Example 5: Generate Multiple Addresses
// ============================================================================

function generateMultipleAddresses(count: number = 5) {
  console.log('\n📬 Generate Multiple Addresses');
  console.log('='.repeat(60));

  console.log(`\nGenerating ${count} addresses...\n`);

  const addresses = [];

  for (let i = 1; i <= count; i++) {
    const wallet = createWallet();
    addresses.push(wallet);

    console.log(`${i}. ${wallet.stealthAddress}`);
  }

  return addresses;
}

// ============================================================================
// Run Examples
// ============================================================================

async function main() {
  console.log('🚀 Veil Wallet Creation Examples\n');
  console.log('This shows how simple it is to create Veil addresses!');

  // Initialize WASM
  await initWasm();

  try {
    // Example 1: Create new wallet (ONE LINE!)
    const newWallet = createNewWallet();

    // Example 2: Restore wallet
    // restoreExistingWallet();

    // Example 3: Save wallet
    // saveWallet(newWallet);

    // Example 4: Generate multiple addresses
    // generateMultipleAddresses(3);

    console.log('\n' + '='.repeat(60));
    console.log('\n✅ Done!\n');
    console.log('Key Takeaways:');
    console.log('  • createWallet() - Generate new wallet (one line!)');
    console.log('  • restoreWallet() - Restore from keys');
    console.log('  • wallet.stealthAddress - The address to share');
    console.log('  • wallet.spendSecretHex - Backup (KEEP SECRET!)');
    console.log('  • wallet.scanSecretHex - Backup (KEEP SECRET!)');

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// ============================================================================
// Quick Reference for Wallet Developers
// ============================================================================

/*

WALLET DEVELOPER QUICK START - ADDRESS GENERATION:

1. Create New Wallet (ONE LINE!):
   ────────────────────────────────
   import { createWallet } from '@blondfrogs/veil-tx-builder';

   const wallet = createWallet();
   console.log('Address:', wallet.stealthAddress);
   console.log('Spend Key:', wallet.spendSecretHex);
   console.log('Scan Key:', wallet.scanSecretHex);

2. Restore Wallet from Keys:
   ──────────────────────────
   import { restoreWallet } from '@blondfrogs/veil-tx-builder';

   const wallet = restoreWallet(spendKeyHex, scanKeyHex);
   console.log('Restored:', wallet.stealthAddress);

3. What to Store:
   ──────────────
   Save these (ENCRYPTED!) to restore wallet later:
   • wallet.spendSecretHex (64 char hex)
   • wallet.scanSecretHex (64 char hex)

   Don't need to save:
   • wallet.stealthAddress (can be regenerated from keys)
   • wallet.spendPubkey / scanPubkey (derived from secret keys)

4. What to Share:
   ──────────────
   Share:
   • wallet.stealthAddress ✅ (safe to share)

   NEVER share:
   • wallet.spendSecret ❌
   • wallet.scanSecret ❌
   • wallet.spendSecretHex ❌
   • wallet.scanSecretHex ❌

5. Complete Example:
   ─────────────────
   // Create wallet
   const wallet = createWallet();

   // Show to user
   showAddress(wallet.stealthAddress);

   // Save encrypted
   const encrypted = encrypt({
     spendKey: wallet.spendSecretHex,
     scanKey: wallet.scanSecretHex,
   }, userPassword);
   saveToFile('wallet.dat', encrypted);

   // Later: restore
   const decrypted = decrypt(loadFromFile('wallet.dat'), userPassword);
   const restored = restoreWallet(decrypted.spendKey, decrypted.scanKey);

That's it! Super simple.

*/

main().catch(console.error);
