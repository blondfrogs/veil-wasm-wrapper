/**
 * Example 5: Complete Wallet Integration
 *
 * This example shows how to integrate all features into a simple wallet class.
 */

import {
  initWasm,
  generatePrivateKey,
  derivePublicKey,
  generateStealthAddress,
  TransactionBuilder,
  scanBlock,
  bytesToHex,
  hexToBytes,
  satoshisToVeil,
  UTXO,
  PublicKey,
  SecretKey,
} from '../src';

/**
 * Simple Veil wallet implementation
 */
class VeilWallet {
  private scanSecret: SecretKey;
  private spendSecret: SecretKey;
  private scanPubkey!: PublicKey;
  private spendPubkey!: PublicKey;
  private utxos: UTXO[] = [];
  private initialized = false;

  constructor(
    scanSecret?: SecretKey,
    spendSecret?: SecretKey
  ) {
    if (scanSecret && spendSecret) {
      // Load existing wallet
      this.scanSecret = scanSecret;
      this.spendSecret = spendSecret;
    } else {
      // Generate new wallet (just create secrets, derive pubkeys after init)
      this.scanSecret = new Uint8Array(32);
      this.spendSecret = new Uint8Array(32);
      crypto.getRandomValues(this.scanSecret);
      crypto.getRandomValues(this.spendSecret);
    }
  }

  /**
   * Initialize wallet (must be called first)
   */
  async initialize() {
    if (!this.initialized) {
      await initWasm();
      // Derive public keys after WASM is initialized
      this.scanPubkey = derivePublicKey(this.scanSecret);
      this.spendPubkey = derivePublicKey(this.spendSecret);
      this.initialized = true;
    }
  }

  /**
   * Get wallet address
   */
  getAddress(): string {
    return generateStealthAddress(this.scanPubkey, this.spendPubkey);
  }

  /**
   * Export wallet keys (for backup)
   */
  exportKeys() {
    return {
      scanSecret: bytesToHex(this.scanSecret),
      spendSecret: bytesToHex(this.spendSecret),
      scanPubkey: bytesToHex(this.scanPubkey),
      spendPubkey: bytesToHex(this.spendPubkey),
      address: this.getAddress(),
    };
  }

  /**
   * Import wallet from keys
   */
  static fromKeys(scanSecretHex: string, spendSecretHex: string): VeilWallet {
    return new VeilWallet(
      hexToBytes(scanSecretHex),
      hexToBytes(spendSecretHex)
    );
  }

  /**
   * Sync wallet with blockchain
   */
  async sync(blockTransactions: Array<{ txid: string; outputs: any[] }>, blockHeight: number) {
    if (!this.initialized) {
      throw new Error('Wallet not initialized. Call initialize() first.');
    }

    const newUtxos = await scanBlock(
      blockTransactions,
      this.scanSecret,
      this.spendSecret,
      this.spendPubkey,
      blockHeight
    );

    this.utxos.push(...newUtxos);

    return {
      found: newUtxos.length,
      total: this.utxos.length,
    };
  }

  /**
   * Get wallet balance
   */
  getBalance(): bigint {
    return this.utxos
      .filter(u => u.spendable)
      .reduce((sum, u) => sum + u.amount, 0n);
  }

  /**
   * Get balance in VEIL
   */
  getBalanceVeil(): number {
    return Number(satoshisToVeil(this.getBalance()));
  }

  /**
   * Get all UTXOs
   */
  getUtxos(): UTXO[] {
    return [...this.utxos];
  }

  /**
   * Get spendable UTXOs
   */
  getSpendableUtxos(): UTXO[] {
    return this.utxos.filter(u => u.spendable);
  }

  /**
   * Send payment
   */
  async send(
    toAddress: string,
    amount: bigint,
    dummyOutputs: any[],
    options?: {
      ringSize?: number;
      feePerKb?: number;
    }
  ) {
    if (!this.initialized) {
      throw new Error('Wallet not initialized. Call initialize() first.');
    }

    const spendableUtxos = this.getSpendableUtxos();
    const balance = this.getBalance();

    if (balance < amount) {
      throw new Error(`Insufficient balance. Have ${satoshisToVeil(balance)} VEIL, need ${satoshisToVeil(amount)} VEIL`);
    }

    const builder = new TransactionBuilder({
      ringSize: options?.ringSize || 11,
      feePerKb: options?.feePerKb || 10000,
    });

    await builder.initialize();

    const result = await builder.buildTransaction(
      this.spendSecret,
      this.scanSecret,
      [{ address: toAddress, amount }],
      spendableUtxos,
      dummyOutputs
    );

    // Mark spent UTXOs
    for (const input of result.inputs) {
      const utxo = this.utxos.find(u => u.txid === input.txid && u.vout === input.vout);
      if (utxo) {
        utxo.spendable = false;
      }
    }

    return result;
  }
}

/**
 * Example usage
 */
async function main() {
  console.log('💼 Veil Wallet Integration Example\n');

  // Step 1: Create or load wallet
  console.log('1️⃣  Creating new wallet...');
  const wallet = new VeilWallet();
  await wallet.initialize();

  const keys = wallet.exportKeys();
  console.log('✅ Wallet created!\n');
  console.log('📧 Address:', keys.address);
  console.log('');

  // Step 2: Save wallet keys (encrypted in production!)
  console.log('2️⃣  Wallet keys (SAVE THESE SECURELY!):');
  console.log('  Scan Secret:', keys.scanSecret);
  console.log('  Spend Secret:', keys.spendSecret);
  console.log('');
  console.log('  To restore wallet:');
  console.log('  ```typescript');
  console.log(`  const wallet = VeilWallet.fromKeys(`);
  console.log(`    "${keys.scanSecret}",`);
  console.log(`    "${keys.spendSecret}"`);
  console.log(`  );`);
  console.log('  ```');
  console.log('');

  // Step 3: Check initial balance
  console.log('3️⃣  Initial balance:');
  console.log(`  ${wallet.getBalanceVeil()} VEIL`);
  console.log('');

  // Step 4: Sync with blockchain (mock data)
  console.log('4️⃣  Syncing with blockchain...');
  console.log('  (In real app, fetch from Veil blockchain API)');
  console.log('');

  // Mock: Simulate syncing a few blocks
  const mockBlocks = [
    {
      height: 12345,
      transactions: [
        { txid: 'tx1...', outputs: [] }, // No outputs for us
        { txid: 'tx2...', outputs: [] }, // No outputs for us
      ],
    },
  ];

  for (const block of mockBlocks) {
    const result = await wallet.sync(block.transactions, block.height);
    console.log(`  Block ${block.height}: Found ${result.found} outputs (Total: ${result.total})`);
  }

  console.log('');
  console.log('💰 Balance after sync:', wallet.getBalanceVeil(), 'VEIL');
  console.log('');

  // Step 5: List UTXOs
  console.log('5️⃣  UTXOs:');
  const utxos = wallet.getUtxos();
  if (utxos.length === 0) {
    console.log('  None (wallet is empty)');
  } else {
    utxos.forEach((utxo, i) => {
      console.log(`  ${i + 1}. ${satoshisToVeil(utxo.amount)} VEIL (${utxo.spendable ? 'spendable' : 'spent'})`);
    });
  }
  console.log('');

  // Step 6: Send payment (commented - needs real UTXOs and decoys)
  console.log('6️⃣  Sending payment (example):');
  console.log('');
  console.log('  ```typescript');
  console.log('  const recipientAddress = "sv1qq...";');
  console.log('  const amount = 100000000n; // 1 VEIL');
  console.log('  const dummyOutputs = await fetchDecoys();');
  console.log('');
  console.log('  const result = await wallet.send(');
  console.log('    recipientAddress,');
  console.log('    amount,');
  console.log('    dummyOutputs');
  console.log('  );');
  console.log('');
  console.log('  console.log("Sent! TXID:", result.txid);');
  console.log('');
  console.log('  // Broadcast transaction');
  console.log('  await broadcastTransaction(result.txHex);');
  console.log('  ```');
  console.log('');

  // Step 7: Real-world integration
  console.log('🌐 Production Integration:');
  console.log('');
  console.log('  1. Store wallet keys encrypted:');
  console.log('     - Use AES-256-GCM with user password');
  console.log('     - Never store keys in plaintext');
  console.log('');
  console.log('  2. Sync with blockchain:');
  console.log('     - Connect to Veil RPC node');
  console.log('     - Fetch blocks since last sync');
  console.log('     - Scan for owned outputs');
  console.log('     - Save UTXOs to database');
  console.log('');
  console.log('  3. Build transactions:');
  console.log('     - Select UTXOs to spend');
  console.log('     - Fetch decoy outputs from network');
  console.log('     - Build and sign transaction');
  console.log('     - Broadcast to network');
  console.log('');
  console.log('  4. Database schema:');
  console.log('     - utxos table: txid, vout, amount, commitment, blind, etc.');
  console.log('     - transactions table: txid, height, timestamp, etc.');
  console.log('     - settings table: last_synced_block, etc.');
  console.log('');

  console.log('📚 Additional Features to Add:');
  console.log('  - Transaction history');
  console.log('  - Address book');
  console.log('  - Multiple addresses');
  console.log('  - Fee estimation');
  console.log('  - Transaction notes');
  console.log('  - Backup & restore');
  console.log('  - HD wallet (BIP32/BIP39)');
  console.log('');
}

main().catch(console.error);
