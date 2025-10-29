# API Reference

Complete API documentation for `@blondfrogs/veil-wasm-wrapper`

## Table of Contents

- [Getting Started](#getting-started)
- [High-Level APIs (Recommended)](#high-level-apis-recommended)
- [Advanced APIs](#advanced-apis)
- [Types & Interfaces](#types--interfaces)
- [Constants](#constants)

---

## Getting Started

```typescript
import { initWasm, createWallet, TransactionBuilder } from '@blondfrogs/veil-wasm-wrapper';

// 1. Initialize WASM (call once at startup)
await initWasm();

// 2. Create or restore wallet
const wallet = createWallet();

// 3. Build transactions
const txBuilder = new TransactionBuilder(wallet);
```

---

## High-Level APIs (Recommended)

These are the primary functions most developers should use.

### Initialization

#### `initWasm(wasmPath?: string): Promise<void>`

Initialize the WASM module. **Must be called first before using any crypto functions.**

```typescript
await initWasm();
```

#### `setDebug(enabled: boolean): void`

Enable or disable debug logging.

```typescript
setDebug(true);  // See internal transaction building logs
```

### Wallet Management

#### `createWallet(): VeilWallet`

✅ **Recommended** - Create a new Veil wallet with random keys.

```typescript
const wallet = createWallet();
console.log('Address:', wallet.stealthAddress);
console.log('Spend Key:', wallet.spendSecretHex); // BACK THIS UP!
console.log('Scan Key:', wallet.scanSecretHex);   // BACK THIS UP!
```

#### `restoreWallet(spendSecret, scanSecret): VeilWallet`

✅ **Recommended** - Restore wallet from backup keys.

```typescript
const wallet = restoreWallet(
  '1234567890abcdef...',  // Spend key hex
  'fedcba0987654321...'   // Scan key hex
);
```

#### `validateAddress(address: string): ValidationResult`

✅ **Recommended** - Validate a stealth address before sending.

```typescript
const result = validateAddress(userInputAddress);
if (result.valid) {
  // Safe to send
} else {
  console.error(result.error); // Show error to user
}
```

#### `isValidAddress(address: string): boolean`

Quick boolean check for address validity.

```typescript
if (isValidAddress(address)) {
  // Valid
}
```

### Transaction Building

#### `class TransactionBuilder`

✅ **Recommended** - Main class for building transactions.

```typescript
const txBuilder = new TransactionBuilder(wallet, {
  ringSize: 11,           // Default ring size
  feePerKB: 100000n,     // Fee rate
});

// Send VEIL
const result = await txBuilder.send(
  spendKey,
  scanKey,
  [{ address: 'sv1qq...', amount: 100000000n }], // 1 VEIL
  myUTXOs
);

console.log('TX ID:', result.txid);
console.log('Fee:', satoshisToVeil(result.fee), 'VEIL');

// Consolidate UTXOs
const consolidation = await txBuilder.consolidateUTXOs(
  spendKey,
  scanKey,
  myUTXOs
);
```

### Blockchain RPC

#### `class RpcRequester`

✅ **Recommended** - Interact with Veil blockchain nodes.

```typescript
// Configure (optional)
RpcRequester.NODE_URL = 'http://localhost:58810';
RpcRequester.NODE_PASSWORD = 'your-rpc-password';

// Get blockchain info
const info = await RpcRequester.getBlockchainInfo();
console.log('Chain:', info.chain);
console.log('Height:', info.blocks);

// Check key image spent status
const statuses = await RpcRequester.checkKeyImages([keyImage]);
if (statuses[0].spent) {
  console.log('Already spent!');
}
```

#### `fetchDecoyOutputs(ringSize, numInputs): Promise<AnonOutput[]>`

✅ **Recommended** - Get decoy outputs for ring signatures.

```typescript
// For 2 inputs with ring size 11
const decoys = await fetchDecoyOutputs(11, 2);
```

### Scanning

#### `scanTransaction(tx, scanSecret, spendPubkey): UTXO[]`

✅ **Recommended** - Scan a transaction for your outputs.

```typescript
const myOutputs = scanTransaction(tx, wallet.scanSecret, wallet.spendPubkey);
console.log(`Found ${myOutputs.length} outputs belonging to you`);
```

#### `getTotalBalance(utxos): bigint`

Calculate total balance from UTXOs.

```typescript
const balance = getTotalBalance(myUTXOs);
console.log('Balance:', satoshisToVeil(balance), 'VEIL');
```

#### `parseWatchOnlyTransactions(data, scanSecret, spendPubkey): ParsedUTXO[]`

Parse transactions from `getwatchonlytxes` RPC call.

```typescript
const rpcData = await RpcRequester.getWatchOnlyTxes(scanKeyHex);
const utxos = parseWatchOnlyTransactions(rpcData, scanSecret, spendPubkey);
```

### Utilities

#### Amount Conversion

```typescript
veilToSatoshis(1.5)      // → 150000000n (bigint)
satoshisToVeil(150000000n) // → 1.5 (number)
formatAmount(150000000n)   // → "1.50000000" (string)
```

#### Hex Conversion

```typescript
const bytes = hexToBytes('deadbeef');
const hex = bytesToHex(bytes); // "deadbeef"
```

---

## Advanced APIs

⚠️ **Advanced** - These are lower-level functions. Most users should use the high-level APIs above.

### Cryptography

#### `generateKeyImage(publicKey, secretKey): KeyImage`

⚠️ Generate key image for preventing double-spending.

```typescript
const keyImage = generateKeyImage(utxo.pubkey, destinationKey);
```

#### `createCommitment(value, blind): Commitment`

⚠️ Create Pedersen commitment.

```typescript
const blind = crypto.getRandomValues(new Uint8Array(32));
const commitment = createCommitment(100000000n, blind);
```

#### `generateRangeProof(params): RangeProof`

⚠️ Generate bulletproof range proof.

```typescript
const proof = generateRangeProof({
  commitment,
  value: 100000000n,
  blind,
  nonce: commitment,
});
```

#### `rewindRangeProof(nonce, commitment, proof): RewindResult`

✅ Rewind range proof to extract value (used for scanning).

```typescript
const result = rewindRangeProof(nonce, commitment, proof);
console.log('Value:', result.value);
console.log('Blind:', bytesToHex(result.blind));
```

#### `generateMlsag(params): MlsagSignature`

⚠️ Generate MLSAG ring signature.

#### `verifyMlsag(params): boolean`

⚠️ Verify MLSAG ring signature.

### Stealth Addresses

#### `generateStealthAddress(scanPubkey, spendPubkey): string`

⚠️ Generate stealth address from public keys.

```typescript
const address = generateStealthAddress(scanPub, spendPub);
```

#### `decodeStealthAddress(address): DecodedAddress`

⚠️ Decode stealth address to extract public keys.

```typescript
const decoded = decodeStealthAddress('sv1qq...');
console.log('Scan pubkey:', bytesToHex(decoded.scanPubkey));
```

#### `generateEphemeralKeys(recipientScanPubkey): EphemeralKeys`

⚠️ Generate ephemeral keys for sending to stealth address.

### Key Generation

#### `generatePrivateKey(): Uint8Array`

⚠️ Generate random 32-byte private key.

```typescript
const privKey = generatePrivateKey();
```

#### `derivePublicKey(privateKey): Uint8Array`

⚠️ Derive public key from private key.

```typescript
const pubKey = derivePublicKey(privKey);
```

---

## Types & Interfaces

### `VeilWallet`

```typescript
interface VeilWallet {
  spendSecret: Uint8Array;      // 32 bytes - KEEP SECRET!
  scanSecret: Uint8Array;       // 32 bytes - KEEP SECRET!
  spendPubkey: Uint8Array;      // 33 bytes
  scanPubkey: Uint8Array;       // 33 bytes
  stealthAddress: string;       // "sv1qq..."
  spendSecretHex: string;       // For backup
  scanSecretHex: string;        // For backup
}
```

### `UTXO`

```typescript
interface UTXO {
  txid: string;
  vout: number;
  amount: bigint;
  commitment: Uint8Array;
  blind: Uint8Array;
  pubkey: Uint8Array;
  ephemeralPubkey: Uint8Array;
  keyImage?: Uint8Array;
  blockHeight?: number;
  spendable: boolean;
}
```

### `AnonOutput` (Decoy)

```typescript
interface AnonOutput {
  pubkey: Uint8Array;        // Public key
  commitment: Uint8Array;    // Pedersen commitment
  index: number;            // Blockchain output index
  txid?: string;
  vout?: number;
}
```

### `BlockchainInfo`

```typescript
interface BlockchainInfo {
  blocks: number;           // Current height
  bestblockhash: string;
  chain: string;           // "main", "test", "regtest"
  verificationprogress: number;
  chainwork: string;
}
```

---

## Constants

```typescript
MIN_RING_SIZE          // 3
MAX_RING_SIZE          // 32
DEFAULT_RING_SIZE      // 11
MAX_ANON_INPUTS        // 32
DUST_THRESHOLD         // 1000n satoshis
DEFAULT_FEE_PER_KB     // 100000n satoshis
CONSOLIDATION_THRESHOLD // 50 UTXOs
```

---

## Configuration

### Environment Variables

```bash
# RPC Configuration
VEIL_NODE_URL=http://localhost:58810
VEIL_NODE_PASSWORD=your-rpc-password
VEIL_NODE_USERNAME=veilrpc

# Debug
DEBUG=true  # Enable debug logging
```

### Programmatic Configuration

```typescript
// RPC
RpcRequester.NODE_URL = 'http://localhost:58810';
RpcRequester.NODE_PASSWORD = 'your-password';

// Debug
setDebug(true);

// Transaction Builder
const txBuilder = new TransactionBuilder(wallet, {
  ringSize: 11,
  feePerKB: 100000n,
});
```

---

## Examples

See the [examples/](./examples/) directory for complete working examples:

- `create-wallet.ts` - Wallet creation and restoration
- `build-transaction.ts` - Building RingCT transactions
- `scan-outputs.ts` - Scanning blockchain for your outputs
- `blockchain-integration.ts` - RPC client usage
- `complete-wallet-guide.ts` - Full wallet implementation

---

## Need Help?

- 📚 [Full Documentation](./README.md)
- 💬 [Discord](https://discord.veil-project.com/)
- 🐛 [Report Issues](https://github.com/blondfrogs/veil-wasm-wrapper/issues)

