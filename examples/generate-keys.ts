/**
 * Example 1: Generate Private Keys and Public Keys
 *
 * This example shows how to generate cryptographic keys for a Veil wallet.
 */

import {
  initWasm,
  generatePrivateKey,
  derivePublicKey,
  bytesToHex,
} from '../src';

async function main() {
  console.log('🔐 Veil Key Generation Example\n');

  // Step 1: Initialize WASM module
  console.log('1️⃣  Initializing WASM...');
  await initWasm();
  console.log('✅ WASM initialized\n');

  // Step 2: Generate scan key pair
  console.log('2️⃣  Generating scan key pair...');
  const scanSecret = generatePrivateKey();
  const scanPubkey = derivePublicKey(scanSecret);

  console.log('Scan Private Key:', bytesToHex(scanSecret));
  console.log('Scan Public Key:', bytesToHex(scanPubkey));
  console.log('');

  // Step 3: Generate spend key pair
  console.log('3️⃣  Generating spend key pair...');
  const spendSecret = generatePrivateKey();
  const spendPubkey = derivePublicKey(spendSecret);

  console.log('Spend Private Key:', bytesToHex(spendSecret));
  console.log('Spend Public Key:', bytesToHex(spendPubkey));
  console.log('');

  // Step 4: Show key format
  console.log('📏 Key Format:');
  console.log('  - Private keys: 32 bytes (64 hex characters)');
  console.log('  - Public keys: 33 bytes (66 hex characters, compressed)');
  console.log('');

  // Step 5: Security reminder
  console.log('⚠️  Security Reminder:');
  console.log('  - Store private keys securely (encrypted)');
  console.log('  - Never expose private keys');
  console.log('  - Use HD wallets (BIP32/BIP39) for production');
  console.log('  - Back up your keys!');
  console.log('');

  // Example: Save keys to a secure location (pseudocode)
  console.log('💾 Example: Save keys securely');
  console.log(`
  const wallet = {
    scanSecret: "${bytesToHex(scanSecret)}",
    scanPubkey: "${bytesToHex(scanPubkey)}",
    spendSecret: "${bytesToHex(spendSecret)}",
    spendPubkey: "${bytesToHex(spendPubkey)}",
  };

  // Encrypt and save
  // await encryptAndSave(wallet, password);
  `);
}

main().catch(console.error);
