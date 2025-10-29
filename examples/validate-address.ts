/**
 * Example 17: Validate Address
 *
 * Shows how to validate Veil stealth addresses before sending.
 * ALWAYS validate user input before allowing them to send!
 */

import { validateAddress, isValidAddress, createWallet, initWasm } from '../src';

// ============================================================================
// Example 1: Simple Validation (Boolean)
// ============================================================================

function simpleValidation() {
  console.log('\n✅ Example 1: Simple Validation (Boolean)');
  console.log('='.repeat(60));

  // Create a valid address for testing
  const validWallet = createWallet();
  const validAddress = validWallet.stealthAddress;

  // Test various inputs
  const tests = [
    { address: validAddress, expected: true, label: 'Valid address' },
    { address: 'sv1qqq...', expected: false, label: 'Invalid (too short)' },
    { address: 'bs1qqq...', expected: false, label: 'Wrong prefix' },
    { address: '', expected: false, label: 'Empty string' },
    { address: 'not-an-address', expected: false, label: 'Invalid format' },
  ];

  for (const test of tests) {
    const isValid = isValidAddress(test.address);
    const icon = isValid === test.expected ? '✅' : '❌';
    console.log(`${icon} ${test.label}: ${isValid}`);
  }
}

// ============================================================================
// Example 2: Detailed Validation (With Error Messages)
// ============================================================================

function detailedValidation() {
  console.log('\n📋 Example 2: Detailed Validation');
  console.log('='.repeat(60));

  // Create a valid address
  const wallet = createWallet();
  const address = wallet.stealthAddress;

  console.log('\nValidating address:', address.slice(0, 30) + '...');

  const result = validateAddress(address);

  if (result.valid) {
    console.log('✅ VALID ADDRESS');
    console.log('   Prefix:', result.details?.prefix);
    console.log('   Scan key:', result.details?.scanPubkey.slice(0, 10), '...');
    console.log('   Spend key:', result.details?.spendPubkey.slice(0, 10), '...');
  } else {
    console.log('❌ INVALID ADDRESS');
    console.log('   Error:', result.error);
  }
}

// ============================================================================
// Example 3: UI Validation Pattern
// ============================================================================

function uiValidationPattern() {
  console.log('\n🎨 Example 3: UI Validation Pattern');
  console.log('='.repeat(60));

  // Simulate user input
  const userInputs = [
    'sv1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq',
    'invalid-address',
    '',
    'sv1qqq', // Too short
  ];

  for (const input of userInputs) {
    console.log(`\n📝 User entered: "${input.slice(0, 30)}${input.length > 30 ? '...' : ''}"`);

    const result = validateAddress(input);

    if (result.valid) {
      // Show success state
      console.log('   ✅ Valid address');
      console.log('   🟢 Enable "Send" button');
    } else {
      // Show error state
      console.log(`   ❌ ${result.error}`);
      console.log('   🔴 Disable "Send" button');
      console.log('   💡 Show error to user');
    }
  }
}

// ============================================================================
// Example 4: Form Validation (Real-World Example)
// ============================================================================

interface SendFormData {
  recipient: string;
  amount: string;
}

function validateSendForm(form: SendFormData): {
  valid: boolean;
  errors: { recipient?: string; amount?: string };
} {
  const errors: { recipient?: string; amount?: string } = {};

  // Validate recipient address
  if (!form.recipient) {
    errors.recipient = 'Recipient address is required';
  } else {
    const addressResult = validateAddress(form.recipient);
    if (!addressResult.valid) {
      errors.recipient = addressResult.error;
    }
  }

  // Validate amount
  if (!form.amount || form.amount === '0') {
    errors.amount = 'Amount must be greater than 0';
  } else {
    try {
      const amount = parseFloat(form.amount);
      if (isNaN(amount) || amount <= 0) {
        errors.amount = 'Invalid amount';
      }
    } catch {
      errors.amount = 'Invalid amount format';
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

function formValidationExample() {
  console.log('\n📝 Example 4: Form Validation');
  console.log('='.repeat(60));

  const wallet = createWallet();

  const testForms: SendFormData[] = [
    { recipient: wallet.stealthAddress, amount: '5.5' },
    { recipient: 'invalid', amount: '10' },
    { recipient: wallet.stealthAddress, amount: '0' },
    { recipient: '', amount: '5' },
  ];

  for (const form of testForms) {
    console.log('\n📋 Form:');
    console.log(`   Recipient: ${form.recipient.slice(0, 20)}...`);
    console.log(`   Amount: ${form.amount} VEIL`);

    const result = validateSendForm(form);

    if (result.valid) {
      console.log('   ✅ Form is valid - Ready to send!');
    } else {
      console.log('   ❌ Form has errors:');
      if (result.errors.recipient) {
        console.log(`      • Recipient: ${result.errors.recipient}`);
      }
      if (result.errors.amount) {
        console.log(`      • Amount: ${result.errors.amount}`);
      }
    }
  }
}

// ============================================================================
// Example 5: Real-Time Validation (As User Types)
// ============================================================================

function realTimeValidation() {
  console.log('\n⌨️  Example 5: Real-Time Validation');
  console.log('='.repeat(60));

  const wallet = createWallet();
  const fullAddress = wallet.stealthAddress;

  // Simulate user typing character by character
  const stages = [
    '',
    's',
    'sv',
    'sv1',
    'sv1q',
    'sv1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq',
    fullAddress,
  ];

  console.log('\n⌨️  As user types:\n');

  for (const partial of stages) {
    const result = validateAddress(partial);
    const display = partial.slice(0, 30) + (partial.length > 30 ? '...' : '');

    if (result.valid) {
      console.log(`✅ "${display}" - Valid!`);
    } else {
      // Don't show error until they've typed enough
      if (partial.length < 10) {
        console.log(`⏸️  "${display}" - Keep typing...`);
      } else {
        console.log(`❌ "${display}" - ${result.error}`);
      }
    }
  }
}

// ============================================================================
// Example 6: Complete Wallet Send Flow
// ============================================================================

async function completeSendFlow() {
  console.log('\n💸 Example 6: Complete Send Flow with Validation');
  console.log('='.repeat(60));

  const recipientWallet = createWallet();
  const recipientAddress = recipientWallet.stealthAddress;

  console.log('\n1️⃣ User enters recipient address...');
  console.log(`   ${recipientAddress.slice(0, 40)}...`);

  console.log('\n2️⃣ Validate address before allowing send...');
  const validation = validateAddress(recipientAddress);

  if (!validation.valid) {
    console.log(`❌ Validation failed: ${validation.error}`);
    console.log('🚫 Disable send button');
    console.log('💡 Show error to user');
    return;
  }

  console.log('✅ Address is valid!');
  console.log('🟢 Enable send button');

  console.log('\n3️⃣ User clicks "Send"...');
  console.log('   Building transaction...');
  console.log('   (would call builder.send() here)');

  console.log('\n✅ Transaction sent successfully!');
}

// ============================================================================
// Run Examples
// ============================================================================

async function main() {
  console.log('🔍 Veil Address Validation Examples\n');
  console.log('IMPORTANT: Always validate addresses before sending!');

  // Initialize WASM
  await initWasm();

  try {
    simpleValidation();
    detailedValidation();
    uiValidationPattern();
    formValidationExample();
    realTimeValidation();
    completeSendFlow();

    console.log('\n' + '='.repeat(60));
    console.log('\n✅ All examples complete!\n');
    console.log('Key Takeaways:');
    console.log('  • Use isValidAddress() for quick boolean checks');
    console.log('  • Use validateAddress() for detailed error messages');
    console.log('  • ALWAYS validate before allowing sends');
    console.log('  • Show helpful error messages to users');
    console.log('  • Validate in real-time as users type');

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// ============================================================================
// Quick Reference
// ============================================================================

/*

WALLET DEVELOPER QUICK START - ADDRESS VALIDATION:

1. Simple Validation (Boolean):
   ───────────────────────────
   import { isValidAddress } from '@blondfrogs/veil-tx-builder';

   if (isValidAddress(userInput)) {
     // Enable send button
   } else {
     // Show error
   }

2. Detailed Validation (With Errors):
   ──────────────────────────────────
   import { validateAddress } from '@blondfrogs/veil-tx-builder';

   const result = validateAddress(userInput);
   if (!result.valid) {
     showError(result.error);
   }

3. Form Validation:
   ────────────────
   function validateForm() {
     const addressResult = validateAddress(form.recipient);
     if (!addressResult.valid) {
       setError('recipient', addressResult.error);
       return false;
     }
     return true;
   }

4. Real-Time Validation:
   ─────────────────────
   onInputChange = (value) => {
     const result = validateAddress(value);
     if (value.length > 10 && !result.valid) {
       showError(result.error);
     } else {
       clearError();
     }
   }

REMEMBER:
- Always validate BEFORE sending
- Show clear error messages
- Don't validate on every keystroke until they've typed enough
- Valid addresses start with "sv1"

*/

main().catch(console.error);
