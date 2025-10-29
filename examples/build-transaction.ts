/**
 * Example 3: Build a RingCT Transaction
 *
 * This example shows how to build a complete privacy-preserving transaction.
 */

import {
  initWasm,
  generatePrivateKey,
  derivePublicKey,
  generateStealthAddress,
  generateEphemeralKeys,
  TransactionBuilder,
  bytesToHex,
  satoshisToVeil,
  createCommitment,
  RpcRequester,
  fetchDecoyOutputs,
  type AnonOutput,
  UTXO,
} from '../src';

async function main() {
  console.log('💸 Veil Transaction Building Example\n');

  // Step 1: Initialize WASM
  console.log('1️⃣  Initializing WASM...');
  await initWasm();
  console.log('✅ WASM initialized\n');

  // Step 2: Setup wallet keys (sender)
  console.log('2️⃣  Setting up sender wallet...');
  const senderScanSecret = generatePrivateKey();
  const senderSpendSecret = generatePrivateKey();
  const senderScanPubkey = derivePublicKey(senderScanSecret);
  const senderSpendPubkey = derivePublicKey(senderSpendSecret);
  console.log('✅ Sender keys ready\n');

  // Step 3: Setup recipient address
  console.log('3️⃣  Getting recipient address...');
  const recipientScanPubkey = derivePublicKey(generatePrivateKey());
  const recipientSpendPubkey = derivePublicKey(generatePrivateKey());
  const recipientAddress = generateStealthAddress(recipientScanPubkey, recipientSpendPubkey);

  console.log('📧 Recipient Address:', recipientAddress);
  console.log('');

  // Step 4: Create some mock UTXOs (in real app, these come from blockchain scanning)
  console.log('4️⃣  Preparing UTXOs to spend...');

  // Create sender's stealth address for receiving previous outputs
  const senderAddress = generateStealthAddress(senderScanPubkey, senderSpendPubkey);

  // Generate real commitments for our UTXOs
  const utxo1Amount = 200000000n; // 2 VEIL
  const utxo1Blind = new Uint8Array(32);
  crypto.getRandomValues(utxo1Blind);
  const utxo1Commitment = createCommitment(utxo1Amount, utxo1Blind);

  // Generate proper ephemeral keys for UTXO 1
  const utxo1Ephemeral = await generateEphemeralKeys(senderAddress);

  const utxo2Amount = 150000000n; // 1.5 VEIL
  const utxo2Blind = new Uint8Array(32);
  crypto.getRandomValues(utxo2Blind);
  const utxo2Commitment = createCommitment(utxo2Amount, utxo2Blind);

  // Generate proper ephemeral keys for UTXO 2
  const utxo2Ephemeral = await generateEphemeralKeys(senderAddress);

  const myUtxos: UTXO[] = [
    {
      txid: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      vout: 0,
      amount: utxo1Amount,
      commitment: utxo1Commitment,
      blind: utxo1Blind,
      pubkey: utxo1Ephemeral.destPubkey, // Use proper destination pubkey
      ephemeralPubkey: utxo1Ephemeral.ephemeralPubkey, // Use proper ephemeral pubkey
      blockHeight: 12345,
      spendable: true,
      ringctIndex: 100000, // Mock blockchain output index
    },
    {
      txid: 'fedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
      vout: 1,
      amount: utxo2Amount,
      commitment: utxo2Commitment,
      blind: utxo2Blind,
      pubkey: utxo2Ephemeral.destPubkey, // Use proper destination pubkey
      ephemeralPubkey: utxo2Ephemeral.ephemeralPubkey, // Use proper ephemeral pubkey
      blockHeight: 12346,
      spendable: true,
      ringctIndex: 100001, // Mock blockchain output index
    },
  ];

  const totalInput = myUtxos.reduce((sum, utxo) => sum + utxo.amount, 0n);
  console.log(`  Available: ${satoshisToVeil(totalInput)} VEIL (${myUtxos.length} UTXOs)`);
  console.log('');

  // Step 5: Create dummy outputs (decoys) - try to fetch from blockchain first
  console.log('5️⃣  Preparing decoy outputs...');

  const ringSize = 11; // Total ring size (1 real + 10 decoys)
  let dummyOutputs: AnonOutput[] = [];
  let usingRealDecoys = false;

  // Try to fetch real decoys from blockchain
  console.log('  Attempting to fetch real decoys from blockchain...');
  try {
    const isConnected = await RpcRequester.testConnection();
    if (isConnected) {
      console.log('  ✅ Connected to Veil blockchain');

      // Fetch decoys for our inputs
      dummyOutputs = await fetchDecoyOutputs(ringSize, myUtxos.length);

      usingRealDecoys = true;
      console.log(`  ✅ Fetched ${dummyOutputs.length} real decoy outputs from blockchain`);
      console.log(`  Ring size: ${ringSize} (1 real + ${ringSize - 1} decoys per input)`);
      console.log('');
      console.log('  🎯 Using REAL blockchain decoys:');
      console.log('     - Decoys have valid Pedersen commitments');
      console.log('     - Note: Input UTXOs are still mock for this example');
      console.log('     - With real scanned UTXOs, transaction would fully verify');
      console.log('     - Shows RPC integration is working correctly');
      console.log('');
    } else {
      throw new Error('Could not connect to blockchain');
    }
  } catch (error: any) {
    console.log(`  ⚠️  Could not fetch real decoys: ${error.message}`);
    console.log('  Falling back to mock decoys for demonstration...');
    console.log('');

    // Fall back to mock decoys
    for (let i = 0; i < (ringSize - 1) * myUtxos.length; i++) {
      // Generate commitments for mock decoys (random amounts)
      const decoyAmount = BigInt(Math.floor(Math.random() * 1000000000));
      const decoyBlind = new Uint8Array(32);
      crypto.getRandomValues(decoyBlind);
      const decoyCommitment = createCommitment(decoyAmount, decoyBlind);

      dummyOutputs.push({
        pubkey: derivePublicKey(generatePrivateKey()),
        commitment: decoyCommitment,
        index: 1000 + i,
      });
    }

    console.log(`  Generated ${dummyOutputs.length} mock decoy outputs`);
    console.log(`  Ring size: ${ringSize} (1 real + ${ringSize - 1} decoys per input)`);
    console.log('');
    console.log('  ⚠️  Using MOCK decoys (for demonstration only):');
    console.log('     - Mock decoys have random commitments');
    console.log('     - MLSAG verification will fail (this is expected)');
    console.log('     - Shows the API works, but needs real blockchain data');
    console.log('');
  }

  // Step 6: Define recipients
  console.log('6️⃣  Setting up payment...');

  const recipients = [
    {
      address: recipientAddress,
      amount: 100000000n, // 1 VEIL
    },
  ];

  console.log(`  Sending: ${satoshisToVeil(recipients[0].amount)} VEIL`);
  console.log(`  To: ${recipientAddress}`);
  console.log('');

  // Step 7: Build transaction
  console.log('7️⃣  Building transaction...');
  console.log('  This may take a few seconds (generating range proofs and MLSAG signatures)...');
  console.log('');

  const builder = new TransactionBuilder({
    ringSize: ringSize,
    feePerKb: 10000, // 0.0001 VEIL per KB
    subtractFeeFromOutputs: false,
  });

  await builder.initialize();

  try {
    const result = await builder.buildTransaction(
      senderSpendSecret,
      senderScanSecret,
      recipients,
      myUtxos,
      dummyOutputs
    );

    // Step 8: Show results
    console.log('✅ Transaction built successfully!\n');
    console.log('📋 Transaction Details:');
    console.log('  TXID:', result.txid);
    console.log('  Size:', result.size, 'bytes');
    console.log('  Fee:', satoshisToVeil(result.fee), 'VEIL');
    console.log('  Change:', satoshisToVeil(result.change), 'VEIL');
    console.log('');

    console.log('  Inputs:', result.inputs.length);
    console.log('  Outputs:', result.outputs.length);
    console.log('    - Recipient outputs:', recipients.length);
    console.log('    - Change output:', result.change > 0n ? 1 : 0);
    console.log('');

    console.log('🔐 Privacy Features:');
    console.log('  ✅ Ring signatures (sender anonymous)');
    console.log('  ✅ Stealth addresses (recipient anonymous)');
    console.log('  ✅ Confidential amounts (values hidden)');
    console.log('  ✅ Range proofs (prove validity without revealing)');
    console.log('');

    console.log('📤 Transaction Hex (first 100 chars):');
    console.log('  ', result.txHex.slice(0, 100) + '...');
    console.log('');

    if (usingRealDecoys) {
      console.log('✅ Transaction Status: RPC INTEGRATION WORKING');
      console.log('  This transaction uses real blockchain decoys');
      console.log('  Verification may still fail because input UTXOs are mock');
      console.log('  With real scanned UTXOs, transaction would fully verify');
      console.log('');

      console.log('🔧 For a production-ready transaction:');
      console.log('  1. Scan blockchain for owned outputs (see Example 04)');
      console.log('  2. Use those real UTXOs as inputs');
      console.log('  3. Fetch real decoys (as done here ✅)');
      console.log('  4. Transaction will verify and be ready to broadcast');
      console.log('');

      console.log('  Example: Broadcast transaction');
      console.log('  ```typescript');
      console.log('  import { RpcRequester } from "./src";');
      console.log('  const txid = await RpcRequester.sendRawTransaction(result.txHex);');
      console.log('  console.log("Broadcast! TXID:", txid);');
      console.log('  ```');
      console.log('');
    } else {
      console.log('⚠️  Transaction Status: DEMONSTRATION ONLY');
      console.log('  This transaction uses mock decoys');
      console.log('  MLSAG verification will fail (expected behavior)');
      console.log('  DO NOT broadcast this to the network');
      console.log('');

      console.log('💡 Why does verification fail?');
      console.log('  RingCT requires all ring members to have valid commitment relationships.');
      console.log('  Mock decoys use random commitments that don\'t satisfy the balance equation.');
      console.log('  This is a security feature - the network would reject this transaction.');
      console.log('');

      console.log('🔧 To create a real transaction:');
      console.log('  1. Ensure RPC connection to Veil node');
      console.log('  2. Re-run this example to fetch real decoys');
      console.log('  3. Transaction will verify and be ready to broadcast');
      console.log('');
    }

  } catch (error) {
    console.error('❌ Failed to build transaction:', error);
    console.log('');
    console.log('Common issues:');
    console.log('  - Not enough decoy outputs');
    console.log('  - Invalid UTXOs');
    console.log('  - Insufficient balance');
  }
}

main().catch(console.error);
