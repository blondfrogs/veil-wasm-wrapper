/**
 * Type definitions for Veil transaction builder
 */

// ============================================================================
// Basic Types
// ============================================================================

/** A 32-byte hash or key */
export type Hash = Uint8Array;

/** A public key (33 bytes compressed) */
export type PublicKey = Uint8Array;

/** A secret key (32 bytes) */
export type SecretKey = Uint8Array;

/** A blinding factor (32 bytes) */
export type Blind = Uint8Array;

/** A Pedersen commitment (33 bytes) */
export type Commitment = Uint8Array;

/** A key image (33 bytes) */
export type KeyImage = Uint8Array;

/** A stealth address string (starts with 'sv1') */
export type StealthAddress = string;

/** Transaction ID (hex string) */
export type TxId = string;

// ============================================================================
// UTXO Types
// ============================================================================

/**
 * Unspent transaction output
 */
export interface UTXO {
  /** Transaction ID */
  txid: TxId;
  /** Output index */
  vout: number;
  /** Amount in satoshis */
  amount: bigint;
  /** Pedersen commitment */
  commitment: Commitment;
  /** Blinding factor */
  blind: Blind;
  /** Public key for this output */
  pubkey: PublicKey;
  /** Ephemeral pubkey from tx */
  ephemeralPubkey: PublicKey;
  /** Block height where this output was confirmed */
  blockHeight: number;
  /** Is this output spendable? */
  spendable: boolean;
  /** Blockchain output index (ringct index) - required for building transactions */
  ringctIndex?: number;
}

/**
 * Coin selected for spending
 */
export interface SelectedCoin {
  /** The UTXO being spent */
  utxo: UTXO;
  /** Secret key for this output */
  secretKey: SecretKey;
  /** Key image to prevent double-spend */
  keyImage: KeyImage;
}

// ============================================================================
// Transaction Types
// ============================================================================

/**
 * Veil output types
 */
export enum OutputType {
  /** Null output (marker for CCoinsView) */
  OUTPUT_NULL = 0,
  /** Standard Bitcoin-style output */
  OUTPUT_STANDARD = 1,
  /** Confidential Transaction (blind, no ring) */
  OUTPUT_CT = 2,
  /** Ring Confidential Transaction */
  OUTPUT_RINGCT = 3,
  /** Data output (fee, narration, etc.) */
  OUTPUT_DATA = 4,
}

/**
 * Data output subtypes (vData[0] marker)
 *
 * These markers identify what kind of data is in an OUTPUT_DATA output.
 * Matches Veil Core: /Users/jeremy/veil/src/primitives/transaction.h:40-47
 */
export enum DataOutputTypes {
  /** Plain narration */
  DO_NARR_PLAIN = 1,
  /** Encrypted narration */
  DO_NARR_CRYPT = 2,
  /** Stealth address */
  DO_STEALTH = 3,
  /** Stealth address prefix */
  DO_STEALTH_PREFIX = 4,
  /** Voting data */
  DO_VOTE = 5,
  /** Transaction fee */
  DO_FEE = 6,
  /** Dev fund carry forward */
  DO_DEV_FUND_CFWD = 7,
  /** Fund message */
  DO_FUND_MSG = 8,
}

/**
 * Transaction input (with ring signature)
 */
export interface TxInput {
  /** Ring of public keys (decoys + real) */
  ring: PublicKey[];
  /** Key image */
  keyImage: KeyImage;
  /** Index of real key in ring */
  secretIndex: number;
  /** Secret key for real input */
  secretKey: SecretKey;
  /** Previous output reference */
  prevout: {
    /** Transaction hash (or encoded nInputs + nRingSize for RingCT) */
    hash: Uint8Array;
    /** Output index (0xffffffa0 for RingCT inputs) */
    n: number;
  };
  /** Script signature (empty for RingCT) */
  scriptSig: Uint8Array;
  /** Sequence number */
  nSequence: number;
  /** Script data (key images for RingCT) */
  scriptData?: {
    stack: Uint8Array[];
  };
  /** Script witness (MLSAG signature data) */
  scriptWitness?: {
    stack: Uint8Array[];
  };
  /** Ring member indices (blockchain output indices) */
  ringIndices?: number[];
}

/**
 * Base transaction output
 */
export interface TxOutputBase {
  /** Output type */
  type: OutputType;
  /** Destination stealth address */
  address: StealthAddress;
  /** Amount in satoshis */
  amount: bigint;
  /** Blinding factor */
  blind?: Blind;
}

/**
 * Standard output (OUTPUT_STANDARD)
 */
export interface TxOutputStandard extends TxOutputBase {
  type: OutputType.OUTPUT_STANDARD;
  /** Script pubkey */
  scriptPubKey: Uint8Array;
}

/**
 * CT output (OUTPUT_CT) - Blind amounts, no ring
 */
export interface TxOutputCT extends TxOutputBase {
  type: OutputType.OUTPUT_CT;
  /** Pedersen commitment */
  commitment: Commitment;
  /** Ephemeral public key + prefix */
  vData: Uint8Array;
  /** Script pubkey (like regular Bitcoin output) */
  scriptPubKey: Uint8Array;
  /** Range proof */
  vRangeproof: Uint8Array;
}

/**
 * RingCT output (OUTPUT_RINGCT) - Full privacy
 */
export interface TxOutputRingCT extends TxOutputBase {
  type: OutputType.OUTPUT_RINGCT;
  /** Destination public key (from stealth address) */
  pk: PublicKey;
  /** Pedersen commitment */
  commitment: Commitment;
  /** Ephemeral public key + prefix */
  vData: Uint8Array;
  /** Range proof */
  vRangeproof: Uint8Array;
  // NO scriptPubKey for RingCT
}

/**
 * Data output (OUTPUT_DATA)
 */
export interface TxOutputData extends TxOutputBase {
  type: OutputType.OUTPUT_DATA;
  /** Data payload */
  vData: Uint8Array;
}

/**
 * Transaction output (union of all types)
 */
export type TxOutput = TxOutputStandard | TxOutputCT | TxOutputRingCT | TxOutputData;

/**
 * Legacy output interface (for backward compatibility)
 */
export interface LegacyTxOutput {
  /** Destination stealth address */
  address: StealthAddress;
  /** Amount in satoshis */
  amount: bigint;
  /** Pedersen commitment */
  commitment?: Commitment;
  /** Blinding factor */
  blind?: Blind;
  /** Range proof */
  rangeProof?: Uint8Array;
  /** Ephemeral public key */
  ephemeralPubkey?: PublicKey;
}

/**
 * Veil transaction types
 */
export enum TransactionType {
  /** Standard transaction */
  STANDARD = 0,
  /** Coinbase transaction */
  COINBASE = 1,
  /** Coinstake transaction */
  COINSTAKE = 2,
}

/**
 * RingCT transaction
 */
export interface RingCTTransaction {
  /** Transaction version (low byte) */
  version: number;
  /** Transaction type (high byte) */
  txType?: TransactionType;
  /** Has witness data flag */
  hasWitness: boolean;
  /** Lock time */
  lockTime: number;
  /** Transaction inputs */
  inputs: TxInput[];
  /** Transaction outputs */
  outputs: TxOutput[];
  /** Ring size */
  ringSize: number;
  /** Witness data (MLSAG signature) */
  witness?: {
    /** Script witness stack per input */
    scriptWitness: Array<{
      stack: Uint8Array[];
    }>;
  };
  /** MLSAG signature (legacy, use witness instead) */
  mlsag?: {
    keyImages: Uint8Array;
    c0: Uint8Array;
    ss: Uint8Array;
  };
  /** Fee in satoshis */
  fee: bigint;
  /** Raw transaction hex */
  hex?: string;
}

/**
 * Alias for transaction
 */
export type Transaction = RingCTTransaction;

/**
 * Range proof data
 */
export interface RangeProof {
  /** Proof bytes */
  proof: Uint8Array;
  /** Commitment */
  commitment: Commitment;
  /** Blinding factor */
  blind: Blind;
  /** Nonce */
  nonce: Uint8Array;
}

/**
 * Parameters for building a transaction
 */
export interface TransactionParams {
  /** Recipients and amounts */
  recipients: Array<{
    address: StealthAddress;
    amount: bigint;
  }>;
  /** Transaction fee in satoshis */
  fee: bigint;
  /** Ring size (number of decoys + 1 real) */
  ringSize: number;
  /** Optional: UTXOs to spend (if not provided, will auto-select) */
  utxos?: UTXO[];
  /** Optional: Extra data for transaction */
  data?: Uint8Array;
}

// ============================================================================
// Wallet Types
// ============================================================================

/**
 * HD wallet keys (BIP32/BIP39)
 */
export interface WalletKeys {
  /** Master seed (from mnemonic) */
  seed: Uint8Array;
  /** Scan key (for detecting incoming tx) */
  scanKey: SecretKey;
  /** Scan public key */
  scanPubkey: PublicKey;
  /** Spend key (for spending outputs) */
  spendKey: SecretKey;
  /** Spend public key */
  spendPubkey: PublicKey;
  /** Stealth address */
  address: StealthAddress;
}

/**
 * Wallet balance
 */
export interface Balance {
  /** Total balance in satoshis */
  total: bigint;
  /** Confirmed balance */
  confirmed: bigint;
  /** Unconfirmed balance */
  unconfirmed: bigint;
  /** Number of UTXOs */
  utxoCount: number;
}

// ============================================================================
// RPC Types
// ============================================================================

/**
 * Anonymous output from blockchain
 */
export interface AnonOutput {
  /** Public key */
  pubkey: PublicKey;
  /** Pedersen commitment */
  commitment: Commitment;
  /** Output index in global anon set */
  index: number;
}

/**
 * RPC response for getanonoutputs
 */
export interface GetAnonOutputsResponse {
  /** Array of anonymous outputs */
  outputs: AnonOutput[];
  /** Total number of outputs in anon set */
  total: number;
}

/**
 * RPC client configuration
 */
export interface RpcConfig {
  /** Node URL (e.g., https://explorer-api.veil-project.com) */
  url: string;
  /** Optional: RPC username */
  username?: string;
  /** Optional: RPC password */
  password?: string;
  /** Optional: Timeout in milliseconds */
  timeout?: number;
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Transaction builder errors
 */
export class TransactionBuilderError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'TransactionBuilderError';
  }
}

/**
 * Insufficient funds error
 */
export class InsufficientFundsError extends TransactionBuilderError {
  constructor(required: bigint, available: bigint) {
    super(
      `Insufficient funds: required ${required}, available ${available}`,
      'INSUFFICIENT_FUNDS'
    );
    this.name = 'InsufficientFundsError';
  }
}

/**
 * Invalid address error
 */
export class InvalidAddressError extends TransactionBuilderError {
  constructor(address: string) {
    super(`Invalid stealth address: ${address}`, 'INVALID_ADDRESS');
    this.name = 'InvalidAddressError';
  }
}

/**
 * RPC error
 */
export class RpcError extends TransactionBuilderError {
  constructor(message: string, public statusCode?: number) {
    super(message, 'RPC_ERROR');
    this.name = 'RpcError';
  }
}
