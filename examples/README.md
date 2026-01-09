# Veil Transaction Builder - Examples

This directory contains examples showing how to integrate Veil into your wallet software.

## 🚀 Quick Start for Wallet Developers

**Start here:** [`complete-wallet-guide.ts`](./complete-wallet-guide.ts)

This is the **complete reference implementation** showing the entire wallet lifecycle in one file:
1. Create/Restore Wallet
2. Import to Watch-Only Wallet (RPC)
3. Fetch Transactions (`getwatchonlytxes`)
4. Parse Transactions into UTXOs
5. Check Spent Status
6. Get Balance
7. Send VEIL (with validation)

**Also see:**
- [`create-wallet.ts`](./create-wallet.ts) - Wallet creation examples
- [`validate-address.ts`](./validate-address.ts) - Address validation examples
- [`end-to-end-test.ts`](./end-to-end-test.ts) - Complete integration test with real blockchain

## 📚 Learning Path (for new developers)

If you're new to RingCT and want to understand the fundamentals, follow this sequence:

### **Beginner Level**
1. **`generate-keys.ts`** - Generate private/public keys
2. **`stealth-addresses.ts`** - Create and decode stealth addresses

### **Intermediate Level**
3. **`build-transaction.ts`** - Build a RingCT transaction
4. **`scan-outputs.ts`** - Scan blockchain for your outputs
5. **`wallet-integration.ts`** - Put it all together in a wallet class

### **Advanced Level**
6. **`blockchain-integration.ts`** - RPC integration with Veil node
7. **`end-to-end-test.ts`** - Full end-to-end test with real data

### **Production Ready**
8. **`complete-wallet-guide.ts`** ⭐ - Complete wallet implementation (USE THIS!)
9. **`create-wallet.ts`** - Wallet creation patterns
10. **`validate-address.ts`** - Address validation patterns

## 🎯 What Each Example Teaches

| Example | What You'll Learn |
|---------|-------------------|
| **generate-keys.ts** | How to generate cryptographic keys for wallets |
| **stealth-addresses.ts** | How Veil's privacy addresses work |
| **build-transaction.ts** | How to build RingCT transactions |
| **scan-outputs.ts** | How to detect transactions sent to you |
| **wallet-integration.ts** | How to organize wallet functionality |
| **blockchain-integration.ts** | How to communicate with Veil nodes |
| **end-to-end-test.ts** | Complete workflow with real blockchain |
| **complete-wallet-guide.ts** ⭐ | **Everything you need for production** |
| **create-wallet.ts** | One-line wallet creation and restoration |
| **validate-address.ts** | Validate addresses before sending |
| **get-balance.ts** | Get wallet balance with caching support |
| **get-balance-with-callback.ts** | Stream UTXO discovery in real-time |
| **ct-scan-balance.ts** | Scan for CT (Confidential Transaction) outputs |
| **ct-to-ringct.ts** | Convert CT outputs to RingCT for enhanced privacy |

## 💡 Recommended Reading Order

### If you're building a wallet:
1. Read **`complete-wallet-guide.ts`** (complete reference)
2. Check **`get-balance.ts`** for efficient balance retrieval with caching
3. Check **`create-wallet.ts`** and **`validate-address.ts`** for specific features
4. Look at **`end-to-end-test.ts`** to see testing patterns

### If you're learning RingCT:
1. Start with **`generate-keys.ts`**
2. Progress through the tutorial series:
   - `stealth-addresses.ts`
   - `build-transaction.ts`
   - `scan-outputs.ts`
   - `wallet-integration.ts`
   - `blockchain-integration.ts`
3. Test with **`end-to-end-test.ts`**
4. See the production API in **`complete-wallet-guide.ts`**

## 🔄 CT (Confidential Transaction) Support

Veil supports two types of private outputs:
- **RingCT** - Ring signatures with MLSAG (most private)
- **CT (Stealth)** - ECDSA signatures with P2PKH scripts (legacy)

If you have CT outputs, use these examples to work with them:

| Example | Description |
|---------|-------------|
| **ct-scan-balance.ts** | Scan for CT outputs and check balance |
| **ct-to-ringct.ts** | Convert CT outputs to RingCT for better privacy |

```bash
# Scan for CT balance
SPEND_SECRET=<hex> SCAN_SECRET=<hex> npx tsx examples/ct-scan-balance.ts

# Convert CT to RingCT
SPEND_SECRET=<hex> SCAN_SECRET=<hex> STEALTH_ADDRESS=<addr> npx tsx examples/ct-to-ringct.ts
```

## 🏃 Running Examples

```bash
# Install dependencies
npm install

# Run any example
npm run example examples/complete-wallet-guide.ts

# Or use ts-node directly
npx ts-node examples/complete-wallet-guide.ts
```

### 📝 Note about test-wallet.json

Some examples (`end-to-end-test.ts`, `scan-outputs.ts`) require a `test-wallet.json` file:

- **First run of `end-to-end-test.ts` automatically creates this file**
- To start fresh: delete `test-wallet.json` and run again
- Or copy `test-wallet.json.example` to `test-wallet.json` to use example keys

The wallet file stores test keys and received outputs for blockchain integration tests.

## 📖 Documentation

For complete API documentation, see:
- [`WALLET_API.md`](../WALLET_API.md) - High-level wallet integration guide
- [`README.md`](../README.md) - Full library documentation

## 🆘 Need Help?

- **Quick integration?** → Start with `complete-wallet-guide.ts`
- **Learning RingCT?** → Start with `generate-keys.ts` and progress through the series
- **Testing?** → See `end-to-end-test.ts` for patterns
- **Specific features?** → Check `create-wallet.ts` and `validate-address.ts`

---

**Pro Tip:** `complete-wallet-guide.ts` is the single most important file. If you only read one example, read that one! 🚀
