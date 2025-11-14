/**
 * Watch-Only Transaction Deserialization
 *
 * Deserializes transaction data returned by getwatchonlytxes RPC method.
 * Matches the Dart implementation in veil_light_plugin.
 */

import { BufferReader } from './buffer-reader';
import { generateKeyImage, performEcdh, rewindRangeProof, privateAdd, getWasm } from './wasm';
import { sha256, derivePublicKey } from './crypto';
import { hexToBytes, bytesToHex } from './utils';
import { debug } from './debug';

/**
 * Watch-only transaction type
 */
export enum WatchOnlyTxType {
  NOTSET = -1,
  STEALTH = 0,
  ANON = 1,
}

/**
 * RingCT output data
 */
export class CTxOutRingCT {
  private pubKey?: Uint8Array;
  private commitment?: Uint8Array;
  private vData?: Uint8Array;
  private vRangeproof?: Uint8Array;
  private vchEphemPK?: Uint8Array;

  private keyImage?: Uint8Array;
  private nAmount?: bigint;
  private blind?: Uint8Array;

  /**
   * Deserialize RingCT output from buffer
   */
  deserialize(buffer: Uint8Array): void {
    const reader = new BufferReader(buffer);

    // Read fixed-size fields
    this.pubKey = reader.readSlice(33);
    this.commitment = reader.readSlice(33);

    // Read variable-length fields
    this.vData = reader.readVarSlice();
    this.vRangeproof = reader.readVarSlice();

    // Extract ephemeral public key from vData (first 33 bytes)
    if (this.vData && this.vData.length >= 33) {
      this.vchEphemPK = this.vData.slice(0, 33);
    }
  }

  /**
   * Decode transaction to extract key image, amount, and blind
   *
   * @param spendSecret - Spend private key
   * @param scanSecret - Scan private key
   */
  async decodeTx(spendSecret: Uint8Array, scanSecret: Uint8Array): Promise<void> {
    if (!this.pubKey || !this.vchEphemPK || !this.commitment || !this.vRangeproof) {
      throw new Error('Transaction not deserialized');
    }

    try {
      // Derive spend public key
      const spendPubkey = derivePublicKey(spendSecret);
      debug('[decodeTx] Spend pubkey derived');

      // Compute stealth shared secret
      // sShared = SHA256(scan_secret * ephemeral_pubkey)
      // Note: performEcdh already returns the SHA256 hash (32 bytes)
      const sShared = performEcdh(this.vchEphemPK, scanSecret);
      debug('[decodeTx] ECDH shared secret (hashed):', sShared.length, 'bytes');

      // Derive destination private key using proper elliptic curve scalar addition
      // destinationKeyPriv = spendSecret + sShared (mod curve_order)
      // This matches: StealthSharedToSecretSpend(sShared, spend_secret, keyDestination)
      const destinationKeyPriv = privateAdd(spendSecret, sShared);
      debug('[decodeTx] Destination key derived (using scalar addition)');

      // Verify destination pubkey matches transaction pubkey
      // This is the check at watchonly.cpp:565-566
      const derivedPubkey = derivePublicKey(destinationKeyPriv);
      debug('[decodeTx] Derived pubkey:', bytesToHex(derivedPubkey).slice(0, 40) + '...');
      debug('[decodeTx] Expected pubkey:', bytesToHex(this.pubKey).slice(0, 40) + '...');

      if (bytesToHex(derivedPubkey) !== bytesToHex(this.pubKey)) {
        throw new Error('Derived destination pubkey does not match transaction pubkey - transaction not for this wallet');
      }
      debug('[decodeTx] ✅ Destination pubkey verified');

      // Generate key image: I = x * H_p(P) where x is private key, P is public key
      this.keyImage = generateKeyImage(this.pubKey, destinationKeyPriv);
      debug('[decodeTx] Key image generated');

      // Perform ECDH to get nonce for range proof rewind
      // Veil Core uses DOUBLE SHA256: anonwallet.cpp:5572-5573
      //   uint256 nonce = key.ECDH(pkEphem);  // Returns SHA256(compressed_point)
      //   CSHA256().Write(nonce.begin(), 32).Finalize(nonce.begin());  // Hash again!
      const wasm = getWasm();
      const ecdhResult = performEcdh(this.vchEphemPK, destinationKeyPriv);  // SHA256(point)
      const nonceHashed = wasm.hashSha256(ecdhResult);  // SHA256(SHA256(point)) - DOUBLE HASH!
      debug('[decodeTx] Nonce from ECDH (double SHA256):', nonceHashed.length, 'bytes');

      // Try to rewind range proof to get amount and blind
      debug('[decodeTx] Attempting range proof rewind...');
      debug('[decodeTx]   Nonce:', nonceHashed.length, 'bytes');
      debug('[decodeTx]   Nonce (hex):', bytesToHex(nonceHashed));
      debug('[decodeTx]   Commitment:', this.commitment.length, 'bytes');
      debug('[decodeTx]   Commitment (hex):', bytesToHex(this.commitment));
      debug('[decodeTx]   Proof:', this.vRangeproof.length, 'bytes');
      debug('[decodeTx]   Proof (first 100 bytes):', bytesToHex(this.vRangeproof.slice(0, 100)));

      try {
        const rewound = rewindRangeProof(nonceHashed, this.commitment, this.vRangeproof);
      debug('[decodeTx] Range proof rewind result:', rewound);

        if (rewound) {
          this.nAmount = rewound.value;
          this.blind = rewound.blind;
      debug('[decodeTx] ✅ Successfully rewound range proof! Amount:', this.nAmount);
        } else {
      debug('[decodeTx] ⚠️  Rewind returned null/undefined');
        }
      } catch (rewindError: any) {
      // console.warn('[decodeTx] ⚠️  Range proof rewind failed:', rewindError.message);
      // console.warn('[decodeTx]     This is expected if transaction was created by different software');
      // console.warn('[decodeTx]     Amount and blind can be provided externally from RPC');
        // Don't throw - we can still use the UTXO if amount/blind come from RPC
      }
    } catch (error: any) {
      // console.error('[decodeTx] ERROR:', error.message);
      // console.error('[decodeTx] Stack:', error.stack);
      throw error;
    }
  }

  // Getters
  getPubKey(): Uint8Array | undefined {
    return this.pubKey;
  }

  getKeyImage(): Uint8Array | undefined {
    return this.keyImage;
  }

  getAmount(): bigint | undefined {
    return this.nAmount;
  }

  getVCHEphemPK(): Uint8Array | undefined {
    return this.vchEphemPK;
  }

  getVData(): Uint8Array | undefined {
    return this.vData;
  }

  getCommitment(): Uint8Array | undefined {
    return this.commitment;
  }

  getBlind(): Uint8Array | undefined {
    return this.blind;
  }

  getRangeProof(): Uint8Array | undefined {
    return this.vRangeproof;
  }

  // Setters (for when amount/blind come from external source like RPC)
  setAmount(amount: bigint): void {
    this.nAmount = amount;
  }

  setBlind(blind: Uint8Array): void {
    this.blind = blind;
  }
}

/**
 * Watch-only transaction
 */
export class CWatchOnlyTx {
  private type?: WatchOnlyTxType;
  private scanSecret?: Uint8Array;
  private txHash?: Uint8Array;
  private txHashHex?: string;
  private txIndex?: number;
  private ringctout?: CTxOutRingCT;

  /**
   * Deserialize watch-only transaction from buffer
   */
  deserialize(buffer: Uint8Array): void {
    const reader = new BufferReader(buffer);

    // Read transaction type
    const typeValue = reader.readInt32();
    switch (typeValue) {
      case 0:
        this.type = WatchOnlyTxType.STEALTH;
        break;
      case 1:
        this.type = WatchOnlyTxType.ANON;
        break;
      default:
        this.type = WatchOnlyTxType.NOTSET;
    }

    // Read scan secret
    this.scanSecret = reader.readSlice(32);

    // Read scan secret flags (we don't use these but need to advance offset)
    reader.readUInt8(); // scanSecretValid
    reader.readUInt8(); // scanSecretCompressed

    // Read transaction hash
    this.txHash = reader.readSlice(32);

    // Read transaction index
    this.txIndex = reader.readUInt32();

    // If ANON type, deserialize RingCT output
    if (this.type === WatchOnlyTxType.ANON) {
      const ctxOut = new CTxOutRingCT();
      const remainingBuffer = buffer.slice(reader.getOffset());
      ctxOut.deserialize(remainingBuffer);
      this.ringctout = ctxOut;
    }
  }

  // Getters
  getType(): WatchOnlyTxType | undefined {
    return this.type;
  }

  getScanSecret(): Uint8Array | undefined {
    return this.scanSecret;
  }

  getTxIndex(): number | undefined {
    return this.txIndex;
  }

  getKeyImage(): Uint8Array | undefined {
    if (!this.ringctout) {
      return undefined;
    }
    return this.ringctout.getKeyImage();
  }

  getAmount(coinValue: bigint = 100000000n): number {
    if (!this.ringctout) {
      return 0;
    }

    const amount = this.ringctout.getAmount();
    if (!amount) {
      return 0;
    }

    // Convert to decimal (amount / COIN)
    return Number(amount) / Number(coinValue);
  }

  getRingCtOut(): CTxOutRingCT | undefined {
    return this.ringctout;
  }

  getId(): string {
    if (this.txHashHex) {
      return this.txHashHex;
    }

    if (!this.txHash) {
      return '';
    }

    // Reverse the hash bytes (Bitcoin convention)
    const reversed = new Uint8Array(this.txHash).reverse();
    this.txHashHex = bytesToHex(reversed);

    return this.txHashHex;
  }

  getTxHash(): Uint8Array | undefined {
    return this.txHash;
  }
}

/**
 * Watch-only transaction with index
 *
 * This is what getwatchonlytxes returns - includes a ringct index
 */
export class CWatchOnlyTxWithIndex extends CWatchOnlyTx {
  private ringctIndex?: number;
  private raw: string = '';

  /**
   * Deserialize from hex string (as returned by getwatchonlytxes)
   */
  deserializeFromHex(rawHex: string): void {
    this.raw = rawHex;
    const buffer = hexToBytes(rawHex);
    this.deserialize(buffer);
  }

  /**
   * Deserialize from buffer
   */
  override deserialize(buffer: Uint8Array): void {
    const reader = new BufferReader(buffer);

    // Read ringct index (8 bytes)
    this.ringctIndex = reader.readUInt64();

    // Deserialize the rest as CWatchOnlyTx
    const remainingBuffer = buffer.slice(8);
    super.deserialize(remainingBuffer);
  }

  getRingCtIndex(): number | undefined {
    return this.ringctIndex;
  }

  getRaw(): string {
    return this.raw;
  }
}

/**
 * Parsed UTXO from watch-only transaction
 */
export interface ParsedUTXO {
  txid: string;
  vout: number;
  amount: bigint;
  commitment: Uint8Array;
  blind: Uint8Array;
  pubkey: Uint8Array;
  ephemeralPubkey: Uint8Array;
  keyImage: Uint8Array;
  ringctIndex?: number;
}

/**
 * Optional transaction metadata from RPC response
 * (e.g., when getwatchonlytxes provides decoded amount/blind)
 */
export interface TransactionMetadata {
  amount?: string | number | bigint; // Can be string from JSON
  blind?: string | Uint8Array; // Can be hex string from JSON
  ringctIndex?: number; // RingCT index from RPC (global output index)
  [key: string]: any; // Allow other fields
}

/**
 * Parse watch-only transactions into UTXOs
 *
 * @param transactions - Array of raw transaction hex strings from getwatchonlytxes
 * @param spendSecret - Spend private key
 * @param scanSecret - Scan private key
 * @param metadata - Optional array of metadata for each transaction (e.g., amount, blind from RPC)
 * @returns Array of parsed UTXOs
 */
export async function parseWatchOnlyTransactions(
  transactions: string[],
  spendSecret: Uint8Array,
  scanSecret: Uint8Array,
  metadata?: TransactionMetadata[]
): Promise<ParsedUTXO[]> {
  const utxos: ParsedUTXO[] = [];

  for (let i = 0; i < transactions.length; i++) {
    const rawTx = transactions[i];
    const txMetadata = metadata?.[i];

    try {
      // Deserialize transaction
      const tx = new CWatchOnlyTxWithIndex();
      tx.deserializeFromHex(rawTx);

      // Only process ANON (RingCT) transactions
      if (tx.getType() !== WatchOnlyTxType.ANON) {
        continue;
      }

      // Get RingCT output
      const ringCtOut = tx.getRingCtOut();
      if (!ringCtOut) {
        continue;
      }

      // Decode transaction to extract amount, blind, key image
      await ringCtOut.decodeTx(spendSecret, scanSecret);

      // If metadata provides amount/blind, use those (they may be more reliable than range proof rewind)
      if (txMetadata?.amount !== undefined) {
        const amount = typeof txMetadata.amount === 'string'
          ? BigInt(txMetadata.amount)
          : BigInt(txMetadata.amount);
        ringCtOut.setAmount(amount);
      debug('[parseWatchOnlyTransactions] Using amount from RPC metadata:', amount);
      }

      if (txMetadata?.blind !== undefined) {
        const blind = typeof txMetadata.blind === 'string'
          ? hexToBytes(txMetadata.blind)
          : txMetadata.blind;
        ringCtOut.setBlind(blind);
      debug('[parseWatchOnlyTransactions] Using blind from RPC metadata');
      }

      // Extract UTXO data
      const amount = ringCtOut.getAmount();
      const commitment = ringCtOut.getCommitment();
      const blind = ringCtOut.getBlind();
      const pubkey = ringCtOut.getPubKey();
      const ephemeralPubkey = ringCtOut.getVCHEphemPK();
      const keyImage = ringCtOut.getKeyImage();

      // Log what we have
      const txId = tx.getId();
      const vout = tx.getTxIndex() || 0;
      debug(`[parseWatchOnlyTransactions] TX ${txId}:${vout}`);
      debug(`  - amount: ${amount ? '✅' : '❌ MISSING'}`);
      debug(`  - commitment: ${commitment ? '✅' : '❌'}`);
      debug(`  - blind: ${blind ? '✅' : '❌ MISSING'}`);
      debug(`  - pubkey: ${pubkey ? '✅' : '❌'}`);
      debug(`  - ephemeralPubkey: ${ephemeralPubkey ? '✅' : '❌'}`);
      debug(`  - keyImage: ${keyImage ? '✅' : '❌'}`);

      // Validate critical fields (pubkey, ephemeralPubkey, commitment, keyImage are essential)
      if (
        !commitment ||
        !pubkey ||
        !ephemeralPubkey ||
        !keyImage
      ) {
        // console.warn(`[parseWatchOnlyTransactions] Skipping - missing critical fields`);
        continue;
      }

      // Warn if amount/blind missing
      if (!amount || !blind) {
        // console.warn(`[parseWatchOnlyTransactions] WARNING: Amount or blind missing!`);
        // console.warn(`  This UTXO cannot be spent until amount/blind are provided.`);
        // console.warn(`  You may need to:`);
        // console.warn(`  1. Check if RPC provides 'value' or 'amount_out' fields`);
        // console.warn(`  2. Fix range proof nonce derivation to match Veil Core`);
        // console.warn(`  3. Manually add amount/blind to wallet file`);
      }

      // Prefer ringctIndex from metadata (RPC), fallback to parsed tx value
      const ringctIndex = txMetadata?.ringctIndex ?? tx.getRingCtIndex();

      utxos.push({
        txid: txId,
        vout,
        amount: amount || 0n, // Use 0 as placeholder if missing
        commitment,
        blind: blind || new Uint8Array(32), // Use zeros as placeholder if missing
        pubkey,
        ephemeralPubkey,
        keyImage,
        ringctIndex,
      });
    } catch (error) {
      console.error(`Error parsing transaction: ${error}`);
      // Continue with next transaction
    }
  }

  return utxos;
}
