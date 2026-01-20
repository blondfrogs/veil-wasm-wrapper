/**
 * Utility: Convert WIF (Wallet Import Format) keys to hex
 *
 * WIF is a base58check encoded format for private keys.
 * This utility decodes WIF to raw 32-byte hex private keys.
 */

// @ts-ignore - no types available
import * as bs58check from 'bs58check';

function wifToHex(wif: string): string {
  try {
    // Decode base58check
    const decoded = bs58check.decode(wif);

    // WIF format: [version byte (1)] [private key (32)] [compression flag (1, optional)]
    // For Veil, version byte is 0x80 for mainnet

    // Check version byte
    if (decoded[0] !== 0x80) {
      throw new Error(`Invalid version byte: ${decoded[0].toString(16)}, expected 0x80`);
    }

    // Extract private key (skip version byte)
    let privateKey: Buffer;

    if (decoded.length === 33) {
      // Uncompressed key: [version][32 bytes]
      privateKey = decoded.slice(1, 33);
    } else if (decoded.length === 34 && decoded[33] === 0x01) {
      // Compressed key: [version][32 bytes][0x01]
      privateKey = decoded.slice(1, 33);
    } else {
      throw new Error(`Invalid WIF length: ${decoded.length}`);
    }

    return privateKey.toString('hex');

  } catch (error: any) {
    throw new Error(`Failed to decode WIF: ${error.message}`);
  }
}

// Example usage
const examples = [
  {
    name: 'Scan Secret',
    wif: 'KwGkrPmKhaKZAu9k33owyMRCoM62KY6v5jdZWwTWeiD59Yy9ryKh',
  },
  {
    name: 'Spend Secret',
    wif: 'L5gSBSM4pFaQQ4Abr2yobsGdAApRrycouhrFjzK4jUdC81qdZQ1d',
  },
];

console.log('WIF to Hex Converter');
console.log('===================');
console.log('');

for (const example of examples) {
  try {
    const hex = wifToHex(example.wif);
    console.log(`${example.name}:`);
    console.log(`  WIF: ${example.wif}`);
    console.log(`  Hex: ${hex}`);
    console.log('');
  } catch (error: any) {
    console.log(`${example.name}: ERROR - ${error.message}`);
    console.log('');
  }
}
