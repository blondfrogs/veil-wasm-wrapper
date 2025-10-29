/**
 * Example 2: Stealth Addresses
 *
 * This example shows how to generate and decode Veil stealth addresses.
 */

import {
  initWasm,
  generatePrivateKey,
  derivePublicKey,
  generateStealthAddress,
  decodeStealthAddress,
  generateEphemeralKeys,
  bytesToHex,
  isValidStealthAddress,
} from '../src';

async function main() {
  console.log('🎭 Veil Stealth Address Example\n');

  // Step 1: Initialize WASM
  console.log('1️⃣  Initializing WASM...');
  await initWasm();
  console.log('✅ WASM initialized\n');

  // Step 2: Generate keys
  console.log('2️⃣  Generating wallet keys...');
  const scanSecret = generatePrivateKey();
  const spendSecret = generatePrivateKey();
  const scanPubkey = derivePublicKey(scanSecret);
  const spendPubkey = derivePublicKey(spendSecret);
  console.log('✅ Keys generated\n');

  // Step 3: Generate stealth address
  console.log('3️⃣  Generating stealth address...');
  const stealthAddress = generateStealthAddress(scanPubkey, spendPubkey);

  console.log('📧 Your Stealth Address:');
  console.log('  ', stealthAddress);
  console.log('');
  console.log('  Format: Bech32 with "sv1" prefix');
  console.log('  Use this to receive Veil payments');
  console.log('');

  // Step 4: Validate address
  console.log('4️⃣  Validating address...');
  const isValid = isValidStealthAddress(stealthAddress);
  console.log('  Valid:', isValid ? '✅ Yes' : '❌ No');
  console.log('');

  // Step 5: Decode stealth address
  console.log('5️⃣  Decoding stealth address...');
  const decoded = decodeStealthAddress(stealthAddress);

  console.log('  Scan Pubkey:', bytesToHex(decoded.scanPubkey));
  console.log('  Spend Pubkey:', bytesToHex(decoded.spendPubkey));
  console.log('  Options:', decoded.options);
  console.log('  Prefix bits:', decoded.prefixNumberBits);
  console.log('');

  // Step 6: Generate ephemeral keys for a payment
  console.log('6️⃣  Generating ephemeral keys for payment...');
  console.log('  (This is what senders do when sending to your address)');
  console.log('');

  const ephemeral = await generateEphemeralKeys(stealthAddress);

  console.log('  Ephemeral Pubkey:', bytesToHex(ephemeral.ephemeralPubkey).slice(0, 40) + '...');
  console.log('  Shared Secret:', bytesToHex(ephemeral.sharedSecret).slice(0, 40) + '...');
  console.log('  Destination Pubkey:', bytesToHex(ephemeral.destPubkey).slice(0, 40) + '...');
  console.log('');

  // Step 7: Explain the flow
  console.log('🔄 Payment Flow:');
  console.log('  1. You give your stealth address to sender');
  console.log('  2. Sender generates ephemeral keys');
  console.log('  3. Sender creates output with destPubkey');
  console.log('  4. You scan blockchain with scanSecret');
  console.log('  5. You detect output and recover value');
  console.log('  6. You spend with derived spend key');
  console.log('');

  // Step 8: Advanced options
  console.log('📝 Advanced: Custom stealth address options');
  const customAddress = generateStealthAddress(scanPubkey, spendPubkey, {
    options: 0,
    numberSignatures: 1,
    prefixNumberBits: 0,
    prefixBitfield: 0,
  });
  console.log('  Custom address:', customAddress);
  console.log('');

  // Step 9: Multiple addresses
  console.log('💡 Tip: Generate new addresses');
  console.log('  For privacy, generate a new address for each payment:');
  console.log('');
  for (let i = 0; i < 3; i++) {
    const newSpendPubkey = derivePublicKey(generatePrivateKey());
    const newAddress = generateStealthAddress(scanPubkey, newSpendPubkey);
    console.log(`  Address ${i + 1}: ${newAddress}`);
  }
  console.log('');
  console.log('  Note: Keep same scanPubkey to detect all payments');
  console.log('  Use different spendPubkey for each address');
}

main().catch(console.error);
