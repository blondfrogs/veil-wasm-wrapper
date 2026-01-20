/**
 * RPC Client for Veil Blockchain
 *
 * Provides communication with Veil nodes via JSON-RPC 2.0
 */

import { Commitment, PublicKey, KeyImage } from './types';
import { hexToBytes, bytesToHex } from './utils';
import { debug } from './debug';

// ============================================================================
// RPC Types
// ============================================================================

/**
 * Anonymous output from blockchain (decoy for ring signatures)
 */
export interface AnonOutput {
  /** Public key of the output */
  pubkey: PublicKey;
  /** Pedersen commitment */
  commitment: Commitment;
  /** Global output index */
  index: number;
  /** Transaction ID (optional) */
  txid?: string;
  /** Output index in transaction (optional) */
  vout?: number;
}

/**
 * Blockchain info response
 */
export interface BlockchainInfo {
  /** Current blockchain height */
  blocks: number;
  /** Best block hash */
  bestblockhash: string;
  /** Chain (main, test, regtest) */
  chain: string;
  /** Verification progress */
  verificationprogress: number;
  /** Chain work */
  chainwork: string;
}

/**
 * Key image check result
 */
export interface KeyImageStatus {
  /** The key image (hex) */
  keyImage: string;
  /** Whether the key image is valid (hex format, 33 bytes) */
  status: 'valid' | 'invalid';
  /** Error message if status is invalid */
  msg?: string;
  /** Whether it's already spent on-chain */
  spent: boolean;
  /** Whether it's spent in mempool (pending) */
  spentinmempool?: boolean;
  /** Transaction ID that spent this key image */
  txid?: string;
}

/**
 * Generic RPC request
 */
interface RPCRequest {
  jsonrpc: '2.0';
  id: number | string;
  method: string;
  params: any[];
}

/**
 * Generic RPC response
 */
interface RPCResponse<T = any> {
  jsonrpc: '2.0';
  id: number | string;
  result?: T;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

// ============================================================================
// RPC Requester Class
// ============================================================================

/**
 * Handles all blockchain RPC communication
 *
 * Default configuration connects to Veil's Zelcore API.
 * Can be reconfigured for custom nodes:
 *
 * @example
 * ```typescript
 * // Method 1: Use default public API
 * const info = await RpcRequester.getBlockchainInfo();
 *
 * // Method 2: Configure via environment variables (recommended)
 * // In your .env file:
 * // VEIL_NODE_URL=http://localhost:58810
 * // VEIL_NODE_PASSWORD=your-rpc-password
 * // VEIL_NODE_USERNAME=veilrpc
 *
 * // Method 3: Configure programmatically
 * RpcRequester.NODE_URL = 'http://localhost:58810';
 * RpcRequester.NODE_PASSWORD = 'your-rpc-password';
 * const outputs = await RpcRequester.getAnonOutputs(100);
 * ```
 */
export class RpcRequester {
  /**
   * RPC endpoint URL
   * Default: Veil's Zelcore API
   * Can be configured via:
   * 1. Environment variable: VEIL_NODE_URL
   * 2. Direct assignment: RpcRequester.NODE_URL = 'http://localhost:58810'
   */
  static NODE_URL =
    (typeof process !== 'undefined' && process.env?.VEIL_NODE_URL) ||
    'https://api.veil.zelcore.io';

  /**
   * RPC authentication password (optional)
   * Only needed for authenticated nodes
   * Can be configured via:
   * 1. Environment variable: VEIL_NODE_PASSWORD
   * 2. Direct assignment: RpcRequester.NODE_PASSWORD = 'your-password'
   */
  static NODE_PASSWORD: string | null =
    (typeof process !== 'undefined' && process.env?.VEIL_NODE_PASSWORD) || null;

  /**
   * RPC username (optional)
   * Default: empty string (common for Veil RPC)
   * Can be configured via:
   * 1. Environment variable: VEIL_NODE_USERNAME
   * 2. Direct assignment: RpcRequester.NODE_USERNAME = 'username'
   */
  static NODE_USERNAME =
    (typeof process !== 'undefined' && process.env?.VEIL_NODE_USERNAME) || '';

  /**
   * Request timeout in milliseconds
   */
  static TIMEOUT_MS = 30000;

  /**
   * Current request ID counter
   */
  private static requestId = 0;

  /**
   * Send a raw RPC request
   *
   * @param method - RPC method name
   * @param params - Method parameters
   * @returns RPC result
   */
  static async send<T = any>(method: string, params: any[] = []): Promise<T> {
    const id = ++this.requestId;

    const request: RPCRequest = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Add basic auth if password is set
    if (this.NODE_PASSWORD) {
      const credentials = `${this.NODE_USERNAME}:${this.NODE_PASSWORD}`;
      const encoded = Buffer.from(credentials).toString('base64');
      headers['Authorization'] = `Basic ${encoded}`;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.TIMEOUT_MS);

      const response = await fetch(this.NODE_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const rpcResponse: RPCResponse<T> = await response.json();

      if (rpcResponse.error) {
        const error = new Error(
          `RPC Error ${rpcResponse.error.code}: ${rpcResponse.error.message}`
        );
        // Attach error code and data for better error handling
        (error as any).code = rpcResponse.error.code;
        (error as any).data = rpcResponse.error.data;
        throw error;
      }

      if (rpcResponse.result === undefined) {
        throw new Error('RPC response missing result');
      }

      return rpcResponse.result;
    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw new Error(`RPC request timeout after ${this.TIMEOUT_MS}ms`);
      }
      throw error;
    }
  }

  /**
   * Get anonymous outputs (decoys for ring signatures)
   *
   * @param inputSize - Number of inputs in the transaction
   * @param ringSize - Number of ring signatures per input
   * @returns Array of anonymous outputs
   */
  static async getAnonOutputs(
    inputSize: number,
    ringSize: number
  ): Promise<AnonOutput[]> {
    const params: any[] = [inputSize, ringSize];

    const result = await this.send<any[]>('getanonoutputs', params);

    debug('[getAnonOutputs] Raw RPC response (first output):');
    debug(JSON.stringify(result[0], null, 2));

    return result.map((output, idx) => {
      // Veil RPC returns the field as "ringctindex"
      const index = output.ringctindex !== undefined ? output.ringctindex :
                    (output.index !== undefined ? output.index :
                    (output.global_index !== undefined ? output.global_index : 0));

      debug(`[getAnonOutputs] Output ${idx}: index=${index} (from RPC field: ${output.ringctindex !== undefined ? 'ringctindex' : output.index !== undefined ? 'index' : output.global_index !== undefined ? 'global_index' : 'default 0'})`);

      return {
        pubkey: hexToBytes(output.pubkey),
        commitment: hexToBytes(output.commitment),
        index,
        txid: output.txid,
        vout: output.vout,
      };
    });
  }

  /**
   * Send raw transaction to the network
   *
   * @param txHex - Serialized transaction (hex string)
   * @returns Transaction ID
   */
  static async sendRawTransaction(txHex: string): Promise<string> {
    return await this.send<string>('sendrawtransaction', [txHex]);
  }

  /**
   * Get blockchain information
   *
   * @returns Blockchain state
   */
  static async getBlockchainInfo(): Promise<BlockchainInfo> {
    return await this.send<BlockchainInfo>('getblockchaininfo', []);
  }

  /**
   * Check if key images are spent
   *
   * @param keyImages - Array of key images to check
   * @returns Array of spent status for each key image
   */
  static async checkKeyImages(
    keyImages: KeyImage[]
  ): Promise<KeyImageStatus[]> {
    const keyImageHexArray = keyImages.map((ki) => bytesToHex(ki));

    const result = await this.send<any>('checkkeyimages', [keyImageHexArray]);

    // Veil Core returns array of objects:
    // [
    //   { "status": "valid", "spent": true, "spentinmempool": false, "txid": "..." },
    //   { "status": "invalid", "msg": "Not hex, or length wasn't 66" }
    // ]
    if (!Array.isArray(result)) {
      throw new Error('checkkeyimages: Expected array response from RPC');
    }

    return result.map((item, index) => {
      // Handle invalid key images
      if (item.status === 'invalid') {
        console.warn(`[RPC] Invalid key image at index ${index}: ${item.msg}`);
        return {
          keyImage: keyImageHexArray[index],
          status: 'invalid' as const,
          msg: item.msg,
          spent: false,
        };
      }

      // Handle valid key images
      return {
        keyImage: keyImageHexArray[index],
        status: 'valid' as const,
        spent: Boolean(item.spent),
        spentinmempool: Boolean(item.spentinmempool),
        txid: item.txid,
      };
    });
  }

  /**
   * Get raw transaction data
   *
   * @param txid - Transaction ID
   * @param verbose - Return decoded transaction (default: false)
   * @returns Raw transaction hex or decoded transaction object
   */
  static async getRawTransaction(
    txid: string,
    verbose = false
  ): Promise<any> {
    return await this.send('getrawtransaction', [txid, verbose]);
  }

  /**
   * Get block by hash
   *
   * @param blockHash - Block hash
   * @param verbosity - 0=hex, 1=object without tx data, 2=object with tx data
   * @returns Block data
   */
  static async getBlock(blockHash: string, verbosity = 1): Promise<any> {
    return await this.send('getblock', [blockHash, verbosity]);
  }

  /**
   * Get block hash by height
   *
   * @param height - Block height
   * @returns Block hash
   */
  static async getBlockHash(height: number): Promise<string> {
    return await this.send<string>('getblockhash', [height]);
  }

  /**
   * List unspent outputs (for wallet)
   *
   * @param minConf - Minimum confirmations (default: 1)
   * @param maxConf - Maximum confirmations (default: 9999999)
   * @param addresses - Filter by addresses (optional)
   * @returns Array of unspent outputs
   */
  static async listUnspent(
    minConf = 1,
    maxConf = 9999999,
    addresses?: string[]
  ): Promise<any[]> {
    const params: any[] = [minConf, maxConf];
    if (addresses) {
      params.push(addresses);
    }
    return await this.send<any[]>('listunspent', params);
  }

  /**
   * Test RPC connection
   *
   * @returns True if connection successful
   */
  static async testConnection(): Promise<boolean> {
    try {
      await this.getBlockchainInfo();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Import light wallet address for watch-only monitoring (Veil-specific)
   *
   * @param scanKeyPrivate - Scan key (private, hex)
   * @param spendKeyPublic - Spend key (public, hex)
   * @param fromBlock - Block timestamp to start scanning from
   * @returns Import result with stealth address
   */
  static async importLightwalletAddress(
    scanKeyPrivate: string,
    spendKeyPublic: string,
    fromBlock: number
  ): Promise<any> {
    return await this.send<any>('importlightwalletaddress', [
      scanKeyPrivate,
      spendKeyPublic,
      fromBlock,
    ]);
  }

  /**
   * Get watch-only sync status (Veil-specific)
   *
   * @param scanKeyPrivate - Scan key (private, hex)
   * @param spendKeyPublic - Spend key (public, hex)
   * @returns Status information
   */
  static async getWatchOnlyStatus(
    scanKeyPrivate: string,
    spendKeyPublic: string
  ): Promise<any> {
    return await this.send<any>('getwatchonlystatus', [
      scanKeyPrivate,
      spendKeyPublic,
    ]);
  }

  /**
   * Get transactions for watch-only address (Veil-specific)
   *
   * @param scanKeyPrivate - Scan key (private, hex)
   * @param offset - Number of transactions to skip
   * @returns Watch-only transactions
   */
  static async getWatchOnlyTxes(
    scanKeyPrivate: string,
    offset = 0
  ): Promise<any> {
    return await this.send<any>('getwatchonlytxes', [scanKeyPrivate, offset]);
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Fetch decoy outputs for ring signatures
 *
 * ✅ **Recommended** - Use this before building transactions.
 *
 * Gets random anonymous outputs from the blockchain to use as decoys (mixins)
 * in ring signatures. Each transaction input needs (ringSize - 1) decoys.
 *
 * @param ringSize - Total ring size (typically 11)
 * @param numInputs - Number of transaction inputs
 * @returns Array of decoy outputs with commitments and public keys
 *
 * @example
 * ```typescript
 * // For a transaction with 2 inputs and ring size 11:
 * const decoys = await fetchDecoyOutputs(11, 2);
 * // Returns ~22 decoy outputs (11 per input, minus the 2 real ones)
 * ```
 */
export async function fetchDecoyOutputs(
  ringSize: number,
  numInputs: number
): Promise<AnonOutput[]> {
  return await RpcRequester.getAnonOutputs(numInputs, ringSize);
}
