/**
 * Example: Send (Broadcast) a Transaction
 *
 * This example shows how to broadcast a transaction to the network.
 *
 * Usage:
 *   npx ts-node examples/send-transaction.ts <transaction_hex>
 *
 * The transaction hex comes from building a transaction (see end-to-end-test.ts)
 */

import { RpcRequester } from '../src/rpc';

async function main() {
  console.log('📤 Broadcast Transaction to Veil Network\n');

  // Get transaction hex from command line argument
  const txHex = process.argv[2];

  if (!txHex) {
    console.log('❌ Error: No transaction hex provided\n');
    console.log('Usage:');
    console.log('  npx ts-node examples/send-transaction.ts <transaction_hex>\n');
    console.log('Example:');
    console.log('  npx ts-node examples/send-transaction.ts 020001000000...\n');
    console.log('Tip: Get transaction hex from:');
    console.log('  • Building a transaction (see end-to-end-test.ts)');
    console.log('  • The output of TransactionBuilder.buildTransaction()');
    console.log('');
    return;
  }

  console.log('Transaction Details:');
  console.log(`  Size: ${txHex.length / 2} bytes`);
  console.log(`  Hex (first 40 chars): ${txHex.slice(0, 40)}...`);
  console.log('');

  try {
    console.log('🚀 Broadcasting to network...');
    const txid = await RpcRequester.sendRawTransaction(txHex);

    console.log('');
    console.log('✅ Transaction broadcast successfully!');
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📋 Transaction ID: ${txid}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('You can check the transaction status:');
    console.log(`  veil-cli getrawtransaction ${txid} 1`);
    console.log('');
    console.log('Or view in a block explorer (if available)');
    console.log('');

  } catch (error: any) {
    console.log('');
    console.log('❌ Broadcast failed:', error.message);
    console.log('');

    // Provide helpful error messages
    if (error.message.includes('bad-txns-inputs-missingorspent')) {
      console.log('💡 Possible reasons:');
      console.log('   • One or more inputs are already spent');
      console.log('   • Transaction inputs don\'t exist');
      console.log('   • Double-spend attempt detected');
    } else if (error.message.includes('bad-anonin')) {
      console.log('💡 Possible reasons:');
      console.log('   • Invalid RingCT signature');
      console.log('   • Duplicate key images');
      console.log('   • Invalid ring members');
    } else if (error.message.includes('insufficient fee')) {
      console.log('💡 The transaction fee is too low');
      console.log('   • Try rebuilding with a higher fee');
    } else if (error.message.includes('bad-txns-oversize')) {
      console.log('💡 The transaction is too large');
      console.log('   • Try using fewer inputs');
      console.log('   • Split into multiple transactions');
    } else {
      console.log('💡 Check the Veil daemon logs for more details');
    }

    console.log('');
    throw error;
  }
}

main().catch((error) => {
  console.error('');
  console.error('❌ Fatal Error:', error.message);
  console.error('');
  process.exit(1);
});
