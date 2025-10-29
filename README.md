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

### Transaction Building (Coming Soon)

```typescript
import { TransactionBuilder, LightWallet } from '@blondfrogs/veil-wasm-wrapper';

async function sendVeil() {
  // Create wallet from mnemonic
  const wallet = await LightWallet.fromMnemonic(
    'your twelve word mnemonic here'
  );

  // Build transaction
  const txBuilder = new TransactionBuilder(wallet);
  const tx = await txBuilder.buildRingCTTransaction({
    recipients: [{
      address: 'sv1qqxxx...',  // Stealth address
      amount: 100_000_000n,     // 1 VEIL
    }],
    fee: 10_000n,
    ringSize: 11,
  });

  // Broadcast
  const txid = await txBuilder.sendTransaction(tx);
  console.log('Transaction sent:', txid);
}
```

---

## 📚 API Reference

### Initialization

```typescript
initWasm(wasmPath?: string): Promise<VeilWasm>
```

Initialize the WASM module. Must be called before using any crypto functions.

### Commitments

```typescript
createCommitment(value: bigint, blind: Uint8Array): Commitment

sumBlinds(blinds: Uint8Array[], nPositive: number): Uint8Array
```

Create Pedersen commitments and sum blinding factors.

### Range Proofs

```typescript
generateRangeProof(params: {
  commitment: Commitment;
  value: bigint;
  blind: Uint8Array;
  nonce: Uint8Array;
  message?: Uint8Array;
}): { proof: Uint8Array; ... }

verifyRangeProof(
  commitment: Commitment,
  proof: Uint8Array
): { minValue: bigint; maxValue: bigint }

rewindRangeProof(
  nonce: Uint8Array,
  commitment: Commitment,
  proof: Uint8Array
): { blind: Uint8Array; value: bigint; ... }
```

Generate, verify, and rewind range proofs.

### Key Images

```typescript
generateKeyImage(
  pk: PublicKey,
  sk: SecretKey
): KeyImage
```

Generate a key image for preventing double-spending.

### Utilities

```typescript
// Amount conversion
veilToSatoshis(veil: number): bigint
satoshisToVeil(satoshis: bigint): number
formatAmount(satoshis: bigint): string

// Hex conversion
hexToBytes(hex: string): Uint8Array
bytesToHex(bytes: Uint8Array): string

// Address validation
isValidStealthAddress(address: string): boolean
```

---

## 🏗️ Project Structure

```
veil-tx-builder/
├── src/
│   ├── index.ts              # Main exports
│   ├── types.ts              # TypeScript type definitions
│   ├── utils.ts              # Utility functions
│   ├── wasm.ts               # WASM interface wrapper
│   ├── TransactionBuilder.ts # (Coming soon)
│   ├── Wallet.ts             # (Coming soon)
│   └── RpcClient.ts          # (Coming soon)
├── examples/
│   ├── minimal-example.js    # Basic usage
│   └── browser-example.html  # (Coming soon)
├── tests/                    # Unit tests
└── dist/                     # Compiled output
```

---

## 🧪 Running Examples

```bash
# Minimal example (demonstrates WASM integration)
npm run example:minimal

# Browser example (coming soon)
npm run example:browser
```

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

## 📋 Roadmap

### ✅ Phase 1: Foundation (Complete)
- [x] Project structure
- [x] TypeScript types
- [x] WASM wrapper interface
- [x] Utility functions
- [x] Basic examples

### 🚧 Phase 2: Transaction Building (In Progress)
- [ ] Port coin selection from Dart
- [ ] Port transaction builder logic
- [ ] Stealth address encoding/decoding
- [ ] MLSAG integration

### 📋 Phase 3: Wallet Management
- [ ] HD wallet (BIP32/BIP39)
- [ ] UTXO tracking
- [ ] Balance calculation
- [ ] Transaction history

### 📋 Phase 4: Integration
- [ ] RPC client for Veil node
- [ ] Browser compatibility testing
- [ ] NPM package publishing
- [ ] Documentation site

---

## ⚠️ Security Warning

**⚠️ NOT PRODUCTION READY ⚠️**

This library is in active development and has not been audited. Do not use with real funds.

**Pending before production:**
- ❌ Security audit
- ❌ Extensive testing
- ❌ Performance optimization
- ❌ Browser compatibility testing

---

## 🤝 Contributing

Contributions welcome! Please fork, create a feature branch, and submit a pull request.

**Areas needing help:**
1. Transaction builder porting from Dart
2. Stealth address bech32 encoding
3. RPC client implementation
4. Testing and documentation

---

## 📄 License

MIT License - See LICENSE file for details

---

## 🔗 Links

- **Crypto Library**: [@blondfrogs/secp256k1-wasm](https://github.com/blondfrogs/veil-secp256k1-wasm)
<!-- MLSAG implementation details are in the crypto library repo -->
- **Veil Project**: https://veil-project.com/
- **Discord**: https://discord.veil-project.com/

---

**Last Updated**: October 24, 2025
**Status**: 🚧 In Development
**Version**: 0.1.0-alpha

Built with 🦀 Rust + TypeScript for the Veil community
