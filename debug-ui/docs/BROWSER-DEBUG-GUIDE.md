# Browser-Based Debug Tool Guide

## Overview

Instead of asking users for their private keys, you can give them a **browser-based debug tool** they run on their own computer.

## Why This Approach is Better

✅ **Zero Trust Required**
- Keys never leave the user's computer
- No need to share sensitive information
- User maintains complete control

✅ **Easy to Use**
- Just open an HTML file in a browser
- No installation required
- Works on Windows, Mac, Linux

✅ **Transparent & Auditable**
- User can inspect the code
- All operations visible in browser console
- Can run offline for maximum security

✅ **Repeatable**
- Users can test multiple times
- Tweak parameters and retry
- Debug at their own pace

## How to Build the Browser Tool

### Step 1: Build the Bundle

```bash
./build-debug-ui.sh
```

This creates a `dist/` folder with:
- `veil-debug.html` - The main debug tool
- `veil-wasm.bundle.js` - Bundled Veil library
- `veil_secp256k1_wasm_bg.wasm` - Crypto WASM module
- `README.txt` - Usage instructions

### Step 2: Package for Distribution

```bash
cd dist
zip -r veil-debug-tool.zip .
```

### Step 3: Share with Users

Send them `veil-debug-tool.zip` with these instructions:

```
1. Extract veil-debug-tool.zip
2. Open veil-debug.html in your browser
3. Follow the on-screen instructions
4. Your keys stay on YOUR computer only
```

## User Workflow

When a user reports a "msg verify message" error:

### Old Way (Risky)
```
User: "I'm getting an error"
You: "Send me your private keys"
User: "Uh... is that safe?"
You: "Trust me"
❌ User has to trust you with their keys
```

### New Way (Safe)
```
User: "I'm getting an error"
You: "Download this debug tool and run it yourself"
User: Downloads veil-debug-tool.zip
User: Runs it on their own computer
User: Sees detailed error diagnostics
User: Reports back: "I see X error when I select Y UTXOs"
✅ User keeps their keys private
✅ You get detailed debug info
```

## Security Features

### For Maximum Security

Users can run this **100% offline**:

1. **Disconnect from internet**
2. Open the debug tool
3. Enter keys and test transactions
4. Review results
5. **Reconnect only to broadcast** (optional)

### What Happens in the Browser

All operations run client-side:
- ✅ WASM cryptography (MLSAG, key images, signatures)
- ✅ Transaction building and signing
- ✅ UTXO fetching (only when connected)
- ✅ Broadcasting (only when user confirms)

Nothing is sent to any server except:
- RPC calls to fetch UTXOs (public blockchain data)
- Broadcast transaction (if user chooses to)

## Debugging with Users

### Scenario 1: Signature Error Diagnosis

**User reports:**
> "Getting 'msg verify message' error"

**You send them the debug tool:**

1. User opens tool
2. Enters their keys
3. Fetches UTXOs
4. Selects UTXOs and builds transaction
5. Gets detailed error:
   ```
   🔍 Diagnosis: Message Verification Failed
   This is a SIGNATURE ERROR - the MLSAG signature is invalid.

   Possible causes:
   • Incorrect key image generation
   • Wrong secret keys being used
   • Invalid ring construction
   ```

6. User reports: "I see signature error when using UTXO index 3"
7. You can now debug knowing it's a signature issue with a specific UTXO

### Scenario 2: Spent Input Diagnosis

**User reports:**
> "Transaction fails to broadcast"

**They run the debug tool:**

1. Fetches UTXOs
2. Shows some are SPENT
3. User sees:
   ```
   🔍 Diagnosis: Inputs Missing or Spent
   The UTXOs are ALREADY SPENT on the blockchain.

   Resolution:
   • Refresh and fetch latest UTXOs
   • Select different (unspent) UTXOs
   ```

4. User reports: "Oh, my UTXOs were already spent!"
5. Issue resolved without you needing their keys

## Customization

### Adding Custom Diagnostics

Edit the error handling in `debug-ui.html`:

```javascript
if (error.message.includes('msg verify message')) {
    diagnostics = `
        <div class="info-box warning">
            <strong>Custom diagnostic message here</strong>
            <br><br>
            Try these specific steps:
            • Step 1
            • Step 2
        </div>
    `;
}
```

### Adding Logging

For more detailed debugging:

```javascript
window.buildTransaction = async function() {
    console.log('Building transaction with:', {
        selectedUTXOs: window.appState.selectedUTXOs,
        amount: sendAmount,
        ringSize: ringSize,
    });

    // ... rest of function
};
```

User can open browser console (F12) and share the logs with you.

## Benefits for Support

### Traditional Support Flow
```
User: "Error!"
You: "What's the error?"
User: "I don't know, something about signatures"
You: "Can I see your transaction?"
User: "I don't know how to export it"
You: "Send me your keys"
User: "That seems unsafe..."
You: "Trust me"
❌ Slow, risky, frustrating
```

### Browser Tool Support Flow
```
User: "Error!"
You: "Run the debug tool I sent you"
User: Opens tool, sees clear error message
User: "It says 'UTXO 3 is already spent'"
You: "Ah, fetch fresh UTXOs"
User: Refreshes, selects new UTXOs, transaction works
✅ Fast, safe, empowering
```

## Distribution Checklist

When preparing to send to users:

- [ ] Build the bundle: `./build-debug-ui.sh`
- [ ] Test in a browser yourself
- [ ] Create the zip file
- [ ] Include clear instructions
- [ ] Mention it works offline
- [ ] Provide support contact

## Example Support Message

```
Hi [User],

To help debug this issue, I've created a tool you can run on your own computer.
Your private keys will NEVER leave your computer.

1. Download: veil-debug-tool.zip
2. Extract the files
3. Open veil-debug.html in your browser
4. Follow the on-screen instructions

The tool will show you exactly what's happening with your transaction
and provide detailed error diagnostics.

For maximum security, you can run this completely offline:
- Disconnect from internet
- Run the tool
- Enter your keys and test
- Reconnect only if you want to broadcast

Let me know what error messages you see!
```

## Advanced: Custom Builds

### For Specific Debug Scenarios

You can create custom versions:

**Version 1: UTXO Inspector**
- Only shows UTXO fetching and spent status
- No transaction building
- For users who just need to check balance

**Version 2: Signature Tester**
- Builds transactions but never broadcasts
- Shows detailed signature data
- For debugging MLSAG issues

**Version 3: Offline Tester**
- Pre-loads mock UTXOs
- No RPC calls
- For testing transaction building logic

### Creating Variants

1. Copy `debug-ui.html` to `debug-ui-utxo-inspector.html`
2. Remove Step 4 and Step 5 (transaction building/broadcasting)
3. Rebuild with custom name

## Troubleshooting

### "WASM not loading"

Make sure all three files are together:
- veil-debug.html
- veil-wasm.bundle.js
- veil_secp256k1_wasm_bg.wasm

### "Cannot fetch UTXOs"

User needs internet connection for RPC calls, or provide offline mode.

### "Transaction builds but broadcast fails"

This is actually GOOD - it means:
- Crypto is working
- Signature generation works
- Issue is with the transaction itself (spent inputs, etc.)

## Future Enhancements

Possible additions:

- [ ] Export transaction hex to file
- [ ] Import UTXO data from file (offline mode)
- [ ] Compare with successful transaction
- [ ] Step-by-step signature verification
- [ ] Visual key image checker
- [ ] UTXO consolidation wizard

## Conclusion

The browser-based approach:
- Protects user privacy
- Empowers users to self-diagnose
- Reduces support burden
- Builds trust
- Provides better debugging data

**Users keep their keys. You get better diagnostics. Everyone wins.**
