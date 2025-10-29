/**
 * Example 6: Blockchain Integration
 *
 * This example shows how to interact with the Veil blockchain using RPC.
 * Demonstrates fetching real decoy outputs for transactions.
 */

import {
  initWasm,
  RpcRequester,
  fetchDecoyOutputs,
  generatePrivateKey,
  derivePublicKey,
  generateStealthAddress,
  TransactionBuilder,
  satoshisToVeil,
  createCommitment,
  type UTXO,
  type AnonOutput,
} from '../src';

async function main() {
  console.log('🌐 Veil Blockchain Integration Example\n');

  // Step 1: Initialize WASM
  console.log('1️⃣  Initializing WASM...');
  await initWasm();
  console.log('✅ WASM initialized\n');

  // Step 2: Configure RPC endpoint (optional)
  console.log('2️⃣  Configuring RPC connection...');
  console.log(`  Using: ${RpcRequester.NODE_URL}`);
  console.log(`  (Configure via VEIL_NODE_URL env variable or programmatically)`);

  // Optional: Use custom node
  // RpcRequester.NODE_URL = 'http://localhost:58810';
  // RpcRequester.NODE_PASSWORD = 'your-rpc-password';
  console.log('');

  // Step 3: Test connection
  console.log('3️⃣  Testing blockchain connection...');
  try {
    const isConnected = await RpcRequester.testConnection();
    if (!isConnected) {
      console.log('❌ Could not connect to Veil blockchain');
      console.log('   Make sure the RPC endpoint is accessible');
      return;
    }
    console.log('✅ Connected to Veil blockchain\n');
  } catch (error: any) {
    console.log('❌ Connection failed:', error.message);
    return;
  }

  // Step 4: Get blockchain info
  console.log('4️⃣  Fetching blockchain information...');
  try {
    const info = await RpcRequester.getBlockchainInfo();
    console.log('  Chain:', info.chain);
    console.log('  Height:', info.blocks);
    console.log('  Best block:', info.bestblockhash.slice(0, 16) + '...');
    console.log('  Sync progress:', (info.verificationprogress * 100).toFixed(2) + '%');
    console.log('');
  } catch (error: any) {
    console.log('⚠️  Could not fetch blockchain info:', error.message);
    console.log('');
  }

  // Step 5: Fetch anonymous outputs (decoys)
  console.log('5️⃣  Fetching anonymous outputs from blockchain...');
  try {
    console.log('  Requesting outputs for 2 inputs with ring size 5...');

    const decoys: AnonOutput[] = await RpcRequester.getAnonOutputs(2, 5);

    console.log(`  ✅ Received ${decoys.length} outputs`);
    console.log('');

    console.log('  Sample outputs:');
    decoys.slice(0, 3).forEach((output, i) => {
      console.log(`    ${i + 1}. Index: ${output.index}`);
      console.log(`       Pubkey: ${Buffer.from(output.pubkey).toString('hex').slice(0, 20)}...`);
      console.log(`       Commitment: ${Buffer.from(output.commitment).toString('hex').slice(0, 20)}...`);
      if (output.txid) {
        console.log(`       TXID: ${output.txid.slice(0, 16)}...`);
      }
    });
    console.log('');
  } catch (error: any) {
    console.log('⚠️  Could not fetch outputs:', error.message);
    console.log('  This feature may require a full node or specific API support');
    console.log('');
  }

  // Step 6: Demonstrate transaction building with real decoys
  console.log('6️⃣  Building transaction with real blockchain decoys...');
  console.log('');

  // Generate wallet keys
  const scanSecret = generatePrivateKey();
  const spendSecret = generatePrivateKey();
  const scanPubkey = derivePublicKey(scanSecret);
  const spendPubkey = derivePublicKey(spendSecret);

  // Create mock UTXO (in real app, from scanning)
  const utxoAmount = 100000000n; // 1 VEIL
  const utxoBlind = new Uint8Array(32);
  crypto.getRandomValues(utxoBlind);
  const utxoCommitment = createCommitment(utxoAmount, utxoBlind);

  const myUtxo: UTXO = {
    txid: 'mock-txid-for-demo-purposes-only-not-real-blockchain-data',
    vout: 0,
    amount: utxoAmount,
    commitment: utxoCommitment,
    blind: utxoBlind,
    pubkey: spendPubkey,
    ephemeralPubkey: new Uint8Array(33).fill(0x02),
    blockHeight: 100000,
    spendable: true,
  };

  console.log('  Setup:');
  console.log(`    UTXO amount: ${satoshisToVeil(myUtxo.amount)} VEIL`);
  console.log('    Ring size: 5 (1 real + 4 decoys)');
  console.log('');

  try {
    console.log('  Fetching decoys from blockchain...');
    const realDecoys = await fetchDecoyOutputs(
      5,  // ring size
      1   // number of inputs
    );

    console.log(`  ✅ Fetched ${realDecoys.length} decoy outputs`);
    console.log('');

    console.log('  📝 These decoys are real blockchain outputs!');
    console.log('     They have valid Pedersen commitments and can be used');
    console.log('     in actual RingCT transactions.');
    console.log('');

    console.log('  To build a complete transaction:');
    console.log('  1. Create transaction builder');
    console.log('  2. Add your real UTXOs');
    console.log('  3. Add these blockchain decoys');
    console.log('  4. Generate MLSAG signatures');
    console.log('  5. Broadcast with RpcRequester.sendRawTransaction()');
    console.log('');

  } catch (error: any) {
    console.log('⚠️  Could not fetch decoys:', error.message);
    console.log('');
  }

  // Step 7: Check key image status (example)
  console.log('7️⃣  Key image verification example...');
  console.log('');

  // Generate a mock key image
  const mockKeyImage = new Uint8Array(33);
  crypto.getRandomValues(mockKeyImage);
  mockKeyImage[0] = 0x02; // Make it a valid point prefix

  try {
    console.log('  Checking if key image is spent...');
    const statuses = await RpcRequester.checkKeyImages([mockKeyImage]);

    console.log(`  Result: ${statuses[0].spent ? 'SPENT ❌' : 'UNSPENT ✅'}`);
    console.log('');
    console.log('  In a real wallet, you would:');
    console.log('  - Check key images before spending UTXOs');
    console.log('  - Prevent double-spending');
    console.log('  - Mark spent outputs in local database');
    console.log('');
  } catch (error: any) {
    console.log('⚠️  Could not check key image:', error.message);
    console.log('  This feature may require specific node configuration');
    console.log('');
  }

  // Step 8: Usage summary
  console.log('📚 RPC Configuration Summary:');
  console.log('');
  console.log('  Current configuration:');
  console.log(`  RpcRequester.NODE_URL = "${RpcRequester.NODE_URL}"`);
  console.log(`  RpcRequester.NODE_PASSWORD = ${RpcRequester.NODE_PASSWORD ? '"***"' : 'null'}`);
  console.log('');
  console.log('  Custom node:');
  console.log('  RpcRequester.NODE_URL = "http://your-node:58810"');
  console.log('  RpcRequester.NODE_PASSWORD = "your-rpc-password"');
  console.log('');
  console.log('  Available methods:');
  console.log('  - RpcRequester.getAnonOutputs(inputSize, ringSize)');
  console.log('  - RpcRequester.sendRawTransaction(txHex)');
  console.log('  - RpcRequester.getBlockchainInfo()');
  console.log('  - RpcRequester.checkKeyImages(keyImages)');
  console.log('  - RpcRequester.getRawTransaction(txid, verbose?)');
  console.log('  - RpcRequester.getBlock(blockHash, verbosity?)');
  console.log('  - RpcRequester.getBlockHash(height)');
  console.log('  - RpcRequester.listUnspent(minConf?, maxConf?, addresses?)');
  console.log('');
  console.log('  Helper functions:');
  console.log('  - fetchDecoyOutputs(ringSize, numInputs)');
  console.log('');
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
