/**
 * Veil Transaction Builder
 *
 * TypeScript library for building RingCT transactions using WASM cryptography
 */

// Export types and enums
export * from './types';
export { OutputType, TransactionType } from './types';

// Export utilities
export * from './utils';

// Export debug utilities
export { setDebug, isDebugEnabled, debug } from './debug';

// Export cryptographic functions (includes WASM wrappers)
export * from './crypto';

// Export stealth address functions
export * from './stealth';

// Export serialization functions
export * from './serialization';

// Export transaction builder
export * from './TransactionBuilder';

// Export UTXO scanner
export * from './scanner';

// Version
export const VERSION = '0.1.0';

// Re-export WASM-specific functions
export {
  initWasm,
  generateKeyImage,
  createCommitment,
  generateRangeProof,
  verifyRangeProof,
  rewindRangeProof,
  performEcdh,
  generateMlsag,
  verifyMlsag,
} from './wasm';

export {
  hexToBytes,
  bytesToHex,
  veilToSatoshis,
  satoshisToVeil,
  formatAmount,
  isValidStealthAddress,
} from './utils';

export {
  derivePublicKey,
  generatePrivateKey,
  sha256,
  getRandomBytes,
} from './crypto';

export {
  generateStealthAddress,
  decodeStealthAddress,
  generateEphemeralKeys,
  createWallet,
  restoreWallet,
  validateAddress,
  isValidAddress,
  type VeilWallet,
} from './stealth';

export {
  scanRingCTOutput,
  scanTransaction,
  scanBlock,
  getTotalBalance,
} from './scanner';

export {
  RpcRequester,
  fetchDecoyOutputs,
  type AnonOutput,
  type BlockchainInfo,
  type KeyImageStatus,
} from './rpc';

export {
  MIN_RING_SIZE,
  MAX_RING_SIZE,
  DEFAULT_RING_SIZE,
  MAX_ANON_INPUTS,
  DUST_THRESHOLD,
  DEFAULT_FEE_PER_KB,
  CONSOLIDATION_THRESHOLD,
} from './TransactionBuilder';

export {
  BufferReader,
} from './buffer-reader';

export {
  CWatchOnlyTx,
  CWatchOnlyTxWithIndex,
  CTxOutRingCT,
  WatchOnlyTxType,
  parseWatchOnlyTransactions,
  type ParsedUTXO,
  type TransactionMetadata,
} from './watch-only-tx';

export {
  getBalance,
  type GetBalanceOptions,
  type BalanceResult,
  type OnUtxoCallback,
} from './balance';
