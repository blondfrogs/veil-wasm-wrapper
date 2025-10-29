# Veil Wallet API - Simple Integration Guide

This guide shows wallet developers how to integrate Veil RingCT transactions with just 5 simple functions.

## 🚀 Quick Start

```typescript
import {
  createWallet,
  restoreWallet,
  validateAddress,
  TransactionBuilder
} from '@blondfrogs/veil-tx-builder';

// Step 1: Create or restore wallet
const wallet = createWallet(); // ONE LINE!
console.log('Address:', wallet.stealthAddress);

// Step 2: Initialize builder once
const builder = new TransactionBuilder({
  ringSize: 11,
  feePerKb: 10000,
});
await builder.initialize();

// Step 3: Always validate before sending!
if (!validateAddress(recipientAddress).valid) {
  console.error('Invalid address!');
}
```

## 🆕 Function 0: Create/Restore Wallet (START HERE!)

### Create New Wallet

```typescript
import { createWallet } from '@blondfrogs/veil-tx-builder';

// ONE FUNCTION CALL - that's it!
const wallet = createWallet();

console.log('Address:', wallet.stealthAddress);
console.log('Spend Key:', wallet.spendSecretHex);
console.log('Scan Key:', wallet.scanSecretHex);

// IMPORTANT: Back up these keys!
```

### Restore Wallet

```typescript
import { restoreWallet } from '@blondfrogs/veil-tx-builder';

const wallet = restoreWallet(
  '1234567890abcdef...',  // Spend key (hex)
  'fedcba0987654321...'   // Scan key (hex)
);

console.log('Restored:', wallet.stealthAddress);
```

### What You Get

```typescript
interface VeilWallet {
  stealthAddress: string;    // The address to share
  spendSecret: Uint8Array;   // Private key (bytes)
  scanSecret: Uint8Array;    // Private key (bytes)
  spendSecretHex: string;    // Private key (hex) - BACK UP!
  scanSecretHex: string;     // Private key (hex) - BACK UP!
  spendPubkey: Uint8Array;   // Public key (derived)
  scanPubkey: Uint8Array;    // Public key (derived)
}
```

### Storage Example

```typescript
// Save (encrypted!)
const walletData = {
  spendKey: wallet.spendSecretHex,
  scanKey: wallet.scanSecretHex,
};
const encrypted = encrypt(JSON.stringify(walletData), userPassword);
saveToFile('wallet.dat', encrypted);

// Load
const decrypted = decrypt(loadFromFile('wallet.dat'), userPassword);
const data = JSON.parse(decrypted);
const wallet = restoreWallet(data.spendKey, data.scanKey);
```

---

## ✅ Function 1: Validate Address (ALWAYS DO THIS FIRST!)

Before sending, **always** validate the recipient's address!

### Simple Validation

```typescript
import { isValidAddress } from '@blondfrogs/veil-tx-builder';

if (isValidAddress(userInputAddress)) {
  // ✅ Enable send button
} else {
  // ❌ Show error
}
```

### Detailed Validation

```typescript
import { validateAddress } from '@blondfrogs/veil-tx-builder';

const result = validateAddress(userInputAddress);

if (result.valid) {
  console.log('✅ Valid address');
  enableSendButton();
} else {
  console.error('❌', result.error);
  showError(result.error);
}
```

### UI Integration

```typescript
// Real-time validation as user types
function onAddressInput(value: string) {
  const result = validateAddress(value);

  if (value.length > 10 && !result.valid) {
    // Show error after they've typed enough
    setError(result.error);
    disableSendButton();
  } else if (result.valid) {
    clearError();
    enableSendButton();
  }
}
```

**Key Points:**
- ✅ Addresses start with `sv1`
- ✅ Returns detailed error messages
- ✅ Validates bech32 checksum
- ✅ Checks public key validity
- ❌ Don't validate on every keystroke until user has typed enough

---

## 📤 Function 2: Send VEIL (Handles Everything Automatically)

```typescript
// ALWAYS validate address first!
if (!isValidAddress(recipientAddress)) {
  throw new Error('Invalid recipient address');
}

const result = await builder.send(
  wallet.spendSecret,
  wallet.scanSecret,
  [{ address: recipientAddress, amount: 5_00000000n }], // 5 VEIL
  myUtxos
);

if (result.success && result.result) {
  // ✅ Transaction ready to broadcast
  await RpcRequester.sendRawTransaction(result.result.txHex);
  console.log('Sent! TXID:', result.result.txid);

} else if (result.multiTxRequired) {
  // ⚠️ Multiple transactions needed (rare)
  console.log('Requires', result.plan.transactions.length, 'transactions');
  console.log('Recommendation:', result.recommendation);
  // Show user a confirmation dialog

} else {
  // ❌ Error occurred
  console.error('Error:', result.error);
  console.log('Tip:', result.recommendation);
}
```

### What `send()` does automatically:
- ✅ Fetches decoy outputs from the network
- ✅ Checks UTXO health and warns about fragmentation
- ✅ Detects if multiple transactions are required
- ✅ Selects optimal inputs using coin selection
- ✅ Calculates fees automatically
- ✅ Provides clear error messages and recommendations
- ✅ Handles all edge cases (32 input limit, insufficient funds, etc.)

---

## 🏥 Function 3: Check Wallet Health (Show in UI)

```typescript
const health = builder.getWalletHealth(myUtxos);

console.log('Status:', health.status);        // 'healthy' | 'fragmented' | 'critical'
console.log('UTXOs:', health.utxoCount);      // Number of UTXOs
console.log('Balance:', health.totalValue);   // Total balance
console.log('Max sendable:', health.maxSendable); // Max in single tx
console.log('Message:', health.message);      // User-friendly message

if (health.shouldConsolidate) {
  // Show "Consolidate UTXOs" button in UI
}
```

### UI Integration Examples:

**Status Badge:**
```typescript
// Show colored badge based on health status
const badge = {
  healthy: '🟢 Healthy',
  fragmented: '🟡 Fragmented',
  critical: '🔴 Critical'
}[health.status];
```

**Warning Banner:**
```typescript
if (health.status === 'critical') {
  showBanner({
    type: 'warning',
    message: health.message,
    action: 'Consolidate Now'
  });
}
```

---

## 🔧 Function 4: Consolidate UTXOs (One Function Call)

```typescript
const result = await builder.consolidate(
  wallet.spendSecret,
  wallet.scanSecret,
  myUtxos
);

if (result.success) {
  console.log('✅ Consolidation complete!');
  console.log('Before:', result.before.utxos, 'UTXOs');
  console.log('After:', result.after.utxos, 'UTXOs');
  console.log('Total fees:', result.totalFees);

  // Broadcast each transaction in sequence
  for (const tx of result.transactions) {
    await RpcRequester.sendRawTransaction(tx.txHex);
    await waitForConfirmation(tx.txid);
  }
} else {
  console.error('Error:', result.error);
}
```

### What `consolidate()` does automatically:
- ✅ Splits into multiple transactions if you have >32 UTXOs
- ✅ Fetches decoys for each transaction
- ✅ Shows progress for each consolidation round
- ✅ Returns all transactions ready to broadcast
- ✅ Calculates total fees across all transactions

---

## 📊 Complete Wallet Integration Example

```typescript
import {
  createWallet,
  restoreWallet,
  TransactionBuilder,
  satoshisToVeil,
  RpcRequester,
  type VeilWallet
} from '@blondfrogs/veil-tx-builder';

class VeilWalletManager {
  private builder: TransactionBuilder;
  private wallet: VeilWallet;

  async init() {
    // Initialize builder
    this.builder = new TransactionBuilder({
      ringSize: 11,
      feePerKb: 10000,
    });
    await this.builder.initialize();

    // Load or create wallet
    this.wallet = await this.loadOrCreateWallet();
  }

  // Create new wallet
  createNewWallet(): VeilWallet {
    return createWallet();
  }

  // Restore from backup
  restoreFromBackup(spendKey: string, scanKey: string): VeilWallet {
    return restoreWallet(spendKey, scanKey);
  }

  private async loadOrCreateWallet(): Promise<VeilWallet> {
    // Try to load from encrypted storage
    // If not found, create new wallet
    return createWallet(); // Simplified
  }

  // Validate address
  validateRecipient(address: string): { valid: boolean; error?: string } {
    const result = validateAddress(address);
    return {
      valid: result.valid,
      error: result.error,
    };
  }

  // Send VEIL
  async send(recipientAddress: string, amount: bigint) {
    // Always validate first!
    const validation = this.validateRecipient(recipientAddress);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error,
      };
    }

    const utxos = await this.getMyUtxos();

    const result = await this.builder.send(
      this.wallet.spendSecret,
      this.wallet.scanSecret,
      [{ address: recipientAddress, amount }],
      utxos
    );

    if (result.success && result.result) {
      const txid = await RpcRequester.sendRawTransaction(result.result.txHex);
      return { success: true, txid };

    } else if (result.multiTxRequired) {
      return {
        success: false,
        requiresMultipleTx: true,
        plan: result.plan
      };

    } else {
      return {
        success: false,
        error: result.error,
        recommendation: result.recommendation
      };
    }
  }

  // Check wallet health
  getHealth() {
    const utxos = this.getMyUtxos();
    return this.builder.getWalletHealth(utxos);
  }

  // Consolidate UTXOs
  async consolidate() {
    const utxos = await this.getMyUtxos();

    const result = await this.builder.consolidate(
      this.wallet.spendSecret,
      this.wallet.scanSecret,
      utxos
    );

    if (result.success) {
      // Broadcast all consolidation transactions
      const txids = [];
      for (const tx of result.transactions) {
        const txid = await RpcRequester.sendRawTransaction(tx.txHex);
        txids.push(txid);
        await this.waitForConfirmation(txid);
      }
      return { success: true, txids };
    } else {
      return { success: false, error: result.error };
    }
  }

  // Get address
  getAddress(): string {
    return this.wallet.stealthAddress;
  }

  // Export wallet for backup
  exportWallet(): { spendKey: string; scanKey: string } {
    return {
      spendKey: this.wallet.spendSecretHex,
      scanKey: this.wallet.scanSecretHex,
    };
  }
}
```

---

## 🎯 Key Benefits

| Benefit | Description |
|---------|-------------|
| **Simple** | Just 5 main functions cover 99% of wallet needs |
| **Smart** | Automatically handles all edge cases |
| **Safe** | Built-in validation and consensus rule enforcement |
| **Fast** | Automatic decoy fetching and optimization |
| **Clear** | Detailed error messages with actionable recommendations |

## 📋 Complete API Summary

| Function | Purpose | Use When |
|----------|---------|----------|
| `createWallet()` | Generate new wallet | User creates new wallet |
| `restoreWallet()` | Restore from keys | User imports existing wallet |
| `validateAddress()` / `isValidAddress()` | Validate address | **Before every send!** |
| `builder.send()` | Send VEIL | User wants to send funds |
| `builder.getWalletHealth()` | Check UTXO health | Show wallet status in UI |
| `builder.consolidate()` | Consolidate UTXOs | Wallet is fragmented |

---

## 🚨 Error Handling Best Practices

```typescript
const result = await builder.send(spendKey, scanKey, recipients, utxos);

if (!result.success) {
  // Always show the error to user
  showError(result.error);

  // Show recommendation if available
  if (result.recommendation) {
    showTip(result.recommendation);
  }

  // Handle specific scenarios
  if (result.multiTxRequired && result.plan) {
    const fees = satoshisToVeil(result.plan.totalFees);
    const txCount = result.plan.transactions.length;

    showDialog({
      title: 'Multiple Transactions Required',
      message: `This send requires ${txCount} transactions with total fees of ${fees} VEIL.`,
      actions: ['Consolidate First', 'Continue Anyway', 'Cancel']
    });
  }
}
```

---

## 📝 Type Definitions

```typescript
// Send result
interface SendResult {
  success: boolean;
  result?: TransactionResult;        // If successful
  multiTxRequired?: boolean;         // If multiple tx needed
  plan?: MultiTxPlan;               // Plan for multiple tx
  warning?: string;                 // Fragmentation warning
  error?: string;                   // Error message
  recommendation?: string;          // What to do next
}

// Consolidate result
interface ConsolidateResult {
  success: boolean;
  transactions: TransactionResult[]; // All transactions
  totalFees: bigint;                // Total fees paid
  before: { utxos: number; value: bigint };
  after: { utxos: number; value: bigint };
  error?: string;
}

// Wallet health
interface WalletHealth {
  status: 'healthy' | 'fragmented' | 'critical';
  utxoCount: number;
  totalValue: bigint;
  maxSendable: bigint;              // Max in single tx
  message: string;                  // User-friendly message
  shouldConsolidate: boolean;       // Show consolidate button?
}
```

---

## 🎓 Advanced Features (If Needed)

While `send()`, `consolidate()`, and `getWalletHealth()` handle 99% of use cases, advanced features are available:

### Low-Level Transaction Building
```typescript
// Manual transaction building (not recommended for most wallets)
const decoys = await fetchDecoyOutputs(ringSize, inputCount);
const result = await builder.buildTransaction(
  spendKey, scanKey, recipients, utxos, decoys
);
```

### UTXO Analysis
```typescript
// Detailed UTXO analysis
const analysis = builder.analyzeUTXOs(utxos);
console.log('Average UTXO:', analysis.averageValue);
console.log('Largest UTXO:', analysis.largestUtxo);
```

### Multi-Transaction Planning
```typescript
// Plan multiple transactions without building
const plan = builder.planMultiTransaction(utxos, largeAmount);
if (plan.feasible) {
  console.log('Will require', plan.transactions.length, 'transactions');
  console.log('Total fees:', plan.totalFees);
}
```

---

## 📦 Constants

Important consensus constants are exported:

```typescript
import {
  MAX_ANON_INPUTS,        // 32 - Maximum inputs per transaction
  MAX_RING_SIZE,          // 32 - Maximum ring size for anonymity
  MIN_RING_SIZE,          // 3  - Minimum ring size
  DEFAULT_RING_SIZE,      // 11 - Recommended ring size
  CONSOLIDATION_THRESHOLD // 10 - Recommend consolidation above this
} from '@blondfrogs/veil-tx-builder';
```

---

## 🐛 Common Issues & Solutions

### Issue: "Transaction would require more than 32 inputs"
**Solution:** The wallet has too many small UTXOs. Call `builder.consolidate()` first.

### Issue: "Multiple transactions required"
**Solution:** This is expected for large amounts with many UTXOs. Either:
1. Consolidate first (recommended)
2. Show the multi-tx plan to user and let them decide

### Issue: Wallet is slow to send
**Solution:** Check `getWalletHealth()`. If fragmented, recommend consolidation.

---

## 💡 Best Practices

1. **Initialize Once**: Create one `TransactionBuilder` instance and reuse it
2. **Check Health Regularly**: Call `getWalletHealth()` when opening wallet
3. **Proactive Consolidation**: Offer consolidation when `shouldConsolidate` is true
4. **Show Progress**: UI should show progress during multi-round consolidation
5. **Handle Errors Gracefully**: Always show `recommendation` to users

---

## 📚 See Also

- Full example: `examples/complete-wallet-guide.ts`
- Transaction builder tests: `tests/TransactionBuilder.test.ts`
- RPC documentation: `src/rpc.ts`

---

## 🆘 Support

For questions or issues:
- GitHub Issues: https://github.com/blondfrogs/veil-wasm-tx-builder
- Discord: https://discord.veil-project.com

---

**That's it!** With just 5 functions (`createWallet`, `restoreWallet`, `validateAddress`, `send`, `consolidate`), you can build a full-featured Veil wallet. 🚀

## 🔍 Address Validation - Important!

**ALWAYS validate addresses before sending!** See [examples/validate-address.ts](./examples/validate-address.ts) for complete validation examples.
