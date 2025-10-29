# Veil Address Generation - Simple Guide

Creating Veil addresses is incredibly simple with this library. Just one function call!

## 🚀 Quick Start

### Create a New Wallet

```typescript
import { createWallet } from '@blondfrogs/veil-tx-builder';

// That's it! Just one line:
const wallet = createWallet();

console.log('Address:', wallet.stealthAddress);
console.log('Spend Key:', wallet.spendSecretHex);
console.log('Scan Key:', wallet.scanSecretHex);
```

**Output:**
```
Address: sv1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq
Spend Key: 1234567890abcdef...
Scan Key: fedcba0987654321...
```

### Restore Wallet from Keys

```typescript
import { restoreWallet } from '@blondfrogs/veil-tx-builder';

const wallet = restoreWallet(
  '1234567890abcdef...',  // Spend key
  'fedcba0987654321...'   // Scan key
);

console.log('Restored:', wallet.stealthAddress);
```

---

## 📦 What You Get

When you call `createWallet()` or `restoreWallet()`, you get a complete wallet object:

```typescript
interface VeilWallet {
  // The address to share with others
  stealthAddress: string;         // "sv1qqq..."

  // Private keys (KEEP SECRET!)
  spendSecret: Uint8Array;        // 32 bytes
  scanSecret: Uint8Array;         // 32 bytes
  spendSecretHex: string;         // 64 hex chars
  scanSecretHex: string;          // 64 hex chars

  // Public keys (derived from private keys)
  spendPubkey: Uint8Array;        // 33 bytes
  scanPubkey: Uint8Array;         // 33 bytes
}
```

---

## 🔐 What to Save & What to Share

### ✅ SAFE to Share (Public)
- `wallet.stealthAddress` - Your receiving address

### ❌ NEVER Share (Private)
- `wallet.spendSecretHex` - Needed to spend funds
- `wallet.scanSecretHex` - Needed to detect incoming transactions
- `wallet.spendSecret` - Binary version of spend key
- `wallet.scanSecret` - Binary version of scan key

### 💾 What to Backup
You only need to backup TWO things (encrypted!):
1. `wallet.spendSecretHex`
2. `wallet.scanSecretHex`

Everything else can be regenerated from these two keys.

---

## 💾 Wallet Storage Example

### Save Wallet (Encrypted)

```typescript
import { createWallet } from '@blondfrogs/veil-tx-builder';
import { encrypt } from 'your-encryption-lib';

// Create wallet
const wallet = createWallet();

// Prepare data to save (only the private keys)
const walletData = {
  spendKey: wallet.spendSecretHex,
  scanKey: wallet.scanSecretHex,
};

// Encrypt with user's password
const encrypted = encrypt(JSON.stringify(walletData), userPassword);

// Save to file/database
fs.writeFileSync('wallet.dat', encrypted);
```

### Load Wallet (Decrypt & Restore)

```typescript
import { restoreWallet } from '@blondfrogs/veil-tx-builder';
import { decrypt } from 'your-encryption-lib';

// Load encrypted data
const encrypted = fs.readFileSync('wallet.dat');

// Decrypt with user's password
const decrypted = decrypt(encrypted, userPassword);
const walletData = JSON.parse(decrypted);

// Restore wallet
const wallet = restoreWallet(walletData.spendKey, walletData.scanKey);

console.log('Wallet restored!');
console.log('Address:', wallet.stealthAddress);
```

---

## 🎯 Common Use Cases

### 1. First-Time User (Create New Wallet)

```typescript
// Check if wallet exists
if (!walletExists()) {
  const wallet = createWallet();

  // Show address to user
  showAddress(wallet.stealthAddress);

  // Prompt user to backup keys
  showBackupPrompt({
    spendKey: wallet.spendSecretHex,
    scanKey: wallet.scanSecretHex,
  });

  // Save encrypted
  saveEncryptedWallet(wallet, userPassword);
}
```

### 2. Returning User (Load Existing Wallet)

```typescript
// Load from encrypted storage
const walletData = loadEncryptedWallet(userPassword);

// Restore wallet
const wallet = restoreWallet(walletData.spendKey, walletData.scanKey);

// Ready to use!
showBalance(wallet);
```

### 3. Import Wallet (From Backup)

```typescript
// User provides their backup keys
const spendKey = prompt('Enter your spend key:');
const scanKey = prompt('Enter your scan key:');

// Restore wallet
try {
  const wallet = restoreWallet(spendKey, scanKey);
  console.log('✅ Wallet imported successfully!');
  console.log('Address:', wallet.stealthAddress);

  // Save to local storage
  saveEncryptedWallet(wallet, userPassword);
} catch (error) {
  console.error('❌ Invalid keys:', error.message);
}
```

### 4. Generate Receive Address (Multiple Addresses)

```typescript
// Generate multiple addresses (e.g., for different purposes)
const personalWallet = createWallet();
const businessWallet = createWallet();
const savingsWallet = createWallet();

console.log('Personal:', personalWallet.stealthAddress);
console.log('Business:', businessWallet.stealthAddress);
console.log('Savings:', savingsWallet.stealthAddress);
```

---

## 🔍 Address Format

Veil stealth addresses:
- Start with `sv1`
- Use Bech32 encoding
- Contain scan and spend public keys
- Are case-insensitive
- Example: `sv1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq`

---

## 🛡️ Security Best Practices

### 1. Key Generation
✅ **Good:** Use `createWallet()` - it uses cryptographically secure random bytes
❌ **Bad:** Generate keys from weak passwords or predictable seeds

### 2. Key Storage
✅ **Good:** Encrypt keys before saving
```typescript
const encrypted = encrypt(wallet.spendSecretHex, strongPassword);
saveToSecureStorage(encrypted);
```

❌ **Bad:** Store keys in plain text
```typescript
// DON'T DO THIS!
localStorage.setItem('spendKey', wallet.spendSecretHex);
```

### 3. Key Backup
✅ **Good:** Multiple secure backups
- Encrypted digital backup
- Paper backup in safe location
- Password manager (encrypted)

❌ **Bad:** Single point of failure
- Only one copy
- Cloud storage without encryption
- Email to yourself

### 4. User Education
Show users clear warnings:

```typescript
function showBackupPrompt(keys: { spendKey: string; scanKey: string }) {
  console.log(`
⚠️  IMPORTANT: Back Up Your Keys

These keys control your VEIL. Without them, you cannot access your funds!

Spend Key: ${keys.spendKey}
Scan Key: ${keys.scanKey}

✅ Write these down on paper
✅ Store in a safe place
✅ Never share with anyone
❌ Don't screenshot or email

□ I have backed up my keys (checkbox)
  `);
}
```

---

## 📊 Complete Wallet Setup Flow

```typescript
import { createWallet, restoreWallet } from '@blondfrogs/veil-tx-builder';

class VeilWalletManager {
  async setupWallet(userPassword: string) {
    // Check if wallet exists
    if (await this.walletExists()) {
      // Load existing wallet
      return await this.loadWallet(userPassword);
    } else {
      // Create new wallet
      return await this.createNewWallet(userPassword);
    }
  }

  async createNewWallet(password: string) {
    // Generate wallet
    const wallet = createWallet();

    // Show backup prompt
    await this.showBackupPrompt({
      address: wallet.stealthAddress,
      spendKey: wallet.spendSecretHex,
      scanKey: wallet.scanSecretHex,
    });

    // Save encrypted
    await this.saveEncrypted({
      spendKey: wallet.spendSecretHex,
      scanKey: wallet.scanSecretHex,
    }, password);

    return wallet;
  }

  async loadWallet(password: string) {
    // Load encrypted data
    const data = await this.loadEncrypted(password);

    // Restore wallet
    return restoreWallet(data.spendKey, data.scanKey);
  }

  async importWallet(spendKey: string, scanKey: string, password: string) {
    // Validate and restore
    const wallet = restoreWallet(spendKey, scanKey);

    // Save encrypted
    await this.saveEncrypted({
      spendKey: wallet.spendSecretHex,
      scanKey: wallet.scanSecretHex,
    }, password);

    return wallet;
  }
}
```

---

## 🐛 Error Handling

```typescript
import { restoreWallet } from '@blondfrogs/veil-tx-builder';

try {
  const wallet = restoreWallet(spendKey, scanKey);
  console.log('✅ Success:', wallet.stealthAddress);
} catch (error) {
  if (error.message.includes('Invalid spend secret key')) {
    console.error('❌ Invalid spend key format');
    // Show user-friendly error
  } else if (error.message.includes('Invalid scan secret key')) {
    console.error('❌ Invalid scan key format');
    // Show user-friendly error
  } else {
    console.error('❌ Unknown error:', error.message);
  }
}
```

---

## 📚 API Reference

### `createWallet(): VeilWallet`

Creates a new wallet with random keys.

**Returns:** Complete wallet object with keys and address

**Example:**
```typescript
const wallet = createWallet();
```

---

### `restoreWallet(spendSecret, scanSecret): VeilWallet`

Restores wallet from existing keys.

**Parameters:**
- `spendSecret: string | Uint8Array` - Spend private key (hex or bytes)
- `scanSecret: string | Uint8Array` - Scan private key (hex or bytes)

**Returns:** Complete wallet object

**Throws:** Error if keys are invalid

**Example:**
```typescript
const wallet = restoreWallet('1234...', '5678...');
```

---

## 💡 Tips & Tricks

### Validate Address Format
```typescript
function isValidVeilAddress(address: string): boolean {
  return address.startsWith('sv1') && address.length > 60;
}
```

### Generate QR Code
```typescript
import QRCode from 'qrcode';

const qr = await QRCode.toDataURL(wallet.stealthAddress);
// Display QR code to user
```

### Check Key Format
```typescript
function isValidKeyFormat(key: string): boolean {
  return /^[0-9a-fA-F]{64}$/.test(key);
}
```

---

## 🆘 Troubleshooting

**Q: "Invalid secret key" error when restoring**

A: Keys must be exactly 64 hexadecimal characters (32 bytes). Check for:
- Missing characters
- Invalid characters (only 0-9, a-f, A-F allowed)
- Extra whitespace

**Q: Different address after restoring**

A: This shouldn't happen! If it does:
- Verify you're using the correct keys
- Check for copy/paste errors
- Ensure keys weren't modified

**Q: Can I use the same keys on multiple devices?**

A: Yes! The same keys always generate the same address. Just make sure to:
- Keep keys synchronized
- Don't spend from multiple devices simultaneously (can cause issues)

---

## 📖 See Also

- Full example: `examples/16-create-wallet.ts`
- Wallet API guide: `WALLET_API.md`
- Transaction building: `TransactionBuilder` class

---

**That's it!** Creating Veil addresses is as simple as calling `createWallet()`. 🚀
