# Veil WASM Wrapper

**TypeScript wrapper for Veil blockchain - transaction builder, wallet management, and RPC client**

[![npm version](https://img.shields.io/npm/v/@blondfrogs/veil-wasm-wrapper.svg)](https://www.npmjs.com/package/@blondfrogs/veil-wasm-wrapper)
[![License](https://img.shields.io/badge/license-MIT-blue)]()

---

## 🎯 Overview

This package provides a comprehensive TypeScript wrapper for the Veil blockchain, enabling transaction building, wallet management, and blockchain interaction in both browser and Node.js environments. Powered by [@blondfrogs/secp256k1-wasm](https://www.npmjs.com/package/@blondfrogs/secp256k1-wasm) - a pure Rust WASM cryptographic library.

**Features:**
- ✅ Type-safe TypeScript API
- ✅ WASM-powered cryptography (no C dependencies!)
- ✅ Stealth address generation and management
- ✅ RingCT transaction building
- ✅ Pedersen commitments & range proofs
- ✅ MLSAG ring signatures
- ✅ Wallet key generation and restoration
- ✅ RPC client for blockchain communication
- ✅ Output scanning and UTXO management
- ✅ Transaction serialization/deserialization

---

## 📦 Installation

```bash
npm install @blondfrogs/veil-wasm-wrapper
```

This will automatically install the required [@blondfrogs/secp256k1-wasm](https://www.npmjs.com/package/@blondfrogs/secp256k1-wasm) dependency.

---

## 🚀 Quick Start

### Basic Usage

```typescript
import { initWasm, createCommitment, generateRangeProof } from '@blondfrogs/veil-wasm-wrapper';

async function example() {
  // Initialize WASM module (call once at startup)
  await initWasm();

  // Create a Pedersen commitment
  const value = 1000000n; // Amount in satoshis
  const blind = crypto.getRandomValues(new Uint8Array(32));
  const commitment = createCommitment(value, blind);

  // Generate a range proof
  const proof = generateRangeProof({
    commitment,
    value,
    blind,
    nonce: commitment, // Use commitment as nonce
  });

  console.log('Proof size:', proof.proof.length, 'bytes');
}
```

### Transaction Building

```typescript
import { initWasm, createWallet, TransactionBuilder } from '@blondfrogs/veil-wasm-wrapper';

async function sendVeil() {
  await initWasm();

  // Create or restore wallet
  const wallet = createWallet();
  console.log('Address:', wallet.stealthAddress);

  // Build transaction
  const txBuilder = new TransactionBuilder(wallet);
  const result = await txBuilder.send(
    wallet.spendSecret,
    wallet.scanSecret,
    [{ address: 'sv1qqxxx...', amount: 100_000_000n }], // 1 VEIL
    myUTXOs
  );

  console.log('Transaction ID:', result.txid);
  console.log('Fee:', result.fee);
}
```

---

## 📚 API Reference

**See [API.md](./API.md) for complete documentation.**

Quick reference:

### Wallet Management
- `createWallet()` - Create new wallet
- `restoreWallet()` - Restore from keys
- `validateAddress()` - Validate stealth addresses

### Transaction Building
- `TransactionBuilder` - Build RingCT transactions
- `fetchDecoyOutputs()` - Get decoys for ring signatures

### Scanning
- `scanTransaction()` - Scan for your outputs
- `parseWatchOnlyTransactions()` - Parse watch-only RPC data

### RPC Client
- `RpcRequester` - Interact with Veil nodes
- `checkKeyImages()` - Check spent status

### Cryptography
- `createCommitment()` - Pedersen commitments
- `generateRangeProof()` - Bulletproofs
- `rewindRangeProof()` - Extract values
- `generateKeyImage()` - Prevent double-spending

---

## 🧪 Examples

See the [examples/](./examples/) directory for complete working examples:
- `create-wallet.ts` - Wallet creation
- `build-transaction.ts` - Transaction building
- `scan-outputs.ts` - Blockchain scanning
- `blockchain-integration.ts` - RPC usage

---

## 🛠️ Development

### Build

```bash
npm run build
```

### Test

```bash
npm test
npm run test:watch
```

### Lint

```bash
npm run lint
```

---

## ⚠️ Security Warning

**⚠️ USE AT YOUR OWN RISK ⚠️**

This library has not been formally audited. Use caution with real funds.

---

## 🤝 Contributing

Contributions welcome! Please open an issue or submit a pull request.

---

## 📄 License

MIT License - See LICENSE file for details

---

## 🔗 Links

- **Crypto Library**: [@blondfrogs/secp256k1-wasm](https://www.npmjs.com/package/@blondfrogs/secp256k1-wasm)
- **Veil Project**: https://veil-project.com/
- **Discord**: https://discord.veil-project.com/

---

Built with 🦀 Rust + TypeScript for the Veil community
