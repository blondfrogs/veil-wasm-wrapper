"use strict";
var VeilWasm = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
    get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
  }) : x)(function(x) {
    if (typeof require !== "undefined") return require.apply(this, arguments);
    throw Error('Dynamic require of "' + x + '" is not supported');
  });
  var __esm = (fn, res) => function __init() {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/debug.ts
  function setDebug(enabled) {
    debugEnabled = enabled;
  }
  function isDebugEnabled() {
    return debugEnabled;
  }
  function debug(...args) {
    if (debugEnabled) {
      console.log("[veil-wasm]", ...args);
    }
  }
  function debugGroup(label, fn) {
    if (debugEnabled) {
      console.group(`[veil-wasm] ${label}`);
      fn();
      console.groupEnd();
    }
  }
  var debugEnabled;
  var init_debug = __esm({
    "src/debug.ts"() {
      "use strict";
      debugEnabled = typeof process !== "undefined" && process.env?.DEBUG === "true";
    }
  });

  // src/wasm.ts
  var wasm_exports = {};
  __export(wasm_exports, {
    createCommitment: () => createCommitment,
    derivePublicKey: () => derivePublicKey,
    ecdsaSign: () => ecdsaSign,
    ecdsaSignCompact: () => ecdsaSignCompact,
    generateKeyImage: () => generateKeyImage,
    generateMlsag: () => generateMlsag,
    generateRangeProof: () => generateRangeProof,
    getWasm: () => getWasm,
    initWasm: () => initWasm,
    performEcdh: () => performEcdh,
    pointAddScalar: () => pointAddScalar,
    pointMultiply: () => pointMultiply,
    prepareMlsag: () => prepareMlsag,
    privateAdd: () => privateAdd,
    rewindRangeProof: () => rewindRangeProof,
    sumBlinds: () => sumBlinds,
    verifyMlsag: () => verifyMlsag,
    verifyRangeProof: () => verifyRangeProof
  });
  async function initWasm(wasmPath) {
    if (wasmModule) {
      return wasmModule;
    }
    try {
      if (typeof window === "undefined") {
        const modulePath = wasmPath || "@blondfrogs/secp256k1-wasm";
        const module = await import(modulePath);
        wasmModule = module;
      } else {
        if (window.wasm_bindgen) {
          console.log("[initWasm] Using preloaded wasm_bindgen from script tag");
          if (typeof window.wasm_bindgen === "function") {
            const module = await window.wasm_bindgen();
            wasmModule = module;
          } else if (typeof window.wasm_bindgen === "object") {
            console.log("[initWasm] wasm_bindgen is already initialized object");
            wasmModule = window.wasm_bindgen;
          }
        } else {
          console.log("[initWasm] Attempting dynamic import");
          const scriptPath = wasmPath || "./veil_wasm.js";
          const module = await import(scriptPath);
          if (module.default && typeof module.default === "function") {
            await module.default();
          }
          wasmModule = module;
        }
      }
      if (wasmModule && wasmModule.init_panic_hook) {
        wasmModule.init_panic_hook();
      }
      return wasmModule;
    } catch (error) {
      throw new Error(`Failed to initialize WASM module: ${error}`);
    }
  }
  function getWasm() {
    if (!wasmModule) {
      throw new Error("WASM module not initialized. Call initWasm() first.");
    }
    return wasmModule;
  }
  function generateKeyImage(pk, sk) {
    const wasm = getWasm();
    return wasm.getKeyImage(pk, sk);
  }
  function performEcdh(pubkey, privkey) {
    const wasm = getWasm();
    return wasm.ecdhVeil(pubkey, privkey);
  }
  function createCommitment(value, blind) {
    const wasm = getWasm();
    return wasm.pedersenCommit(value, blind);
  }
  function sumBlinds(blinds, nPositive) {
    const wasm = getWasm();
    const hexArray = blinds.map((b) => {
      return Array.from(b).map((byte) => byte.toString(16).padStart(2, "0")).join("");
    });
    const blindsJson = JSON.stringify(hexArray);
    return wasm.pedersenBlindSum(blindsJson, nPositive);
  }
  function generateRangeProof(params) {
    const wasm = getWasm();
    const resultJson = wasm.rangeproofSign(
      params.commitment,
      params.value,
      params.blind,
      params.nonce,
      params.message || new Uint8Array(0),
      params.minValue || 0n,
      params.exp ?? -1,
      params.minBits ?? 0
    );
    const result = JSON.parse(resultJson);
    return {
      proof: hexToBytes2(result.proof),
      commitment: hexToBytes2(result.commitment),
      blind: hexToBytes2(result.blind),
      nonce: hexToBytes2(result.nonce)
    };
  }
  function verifyRangeProof(commitment, proof) {
    const wasm = getWasm();
    const resultJson = wasm.rangeproofVerify(commitment, proof);
    const result = JSON.parse(resultJson);
    return {
      minValue: BigInt(result.minValue),
      maxValue: BigInt(result.maxValue)
    };
  }
  function rewindRangeProof(nonce, commitment, proof) {
    const wasm = getWasm();
    try {
      const resultJson = wasm.rangeproofRewind(nonce, commitment, proof);
      debug("[rewindRangeProof] Raw result:", resultJson);
      const result = JSON.parse(resultJson);
      debug("[rewindRangeProof] Parsed result:", result);
      if (result.error) {
        throw new Error(`Range proof rewind failed: ${result.error}`);
      }
      return {
        blind: hexToBytes2(result.blind),
        value: BigInt(result.value),
        minValue: BigInt(result.minValue),
        maxValue: BigInt(result.maxValue),
        message: hexToBytes2(result.message)
      };
    } catch (error) {
      throw new Error(`Could not rewind range proof: ${error.message || error}`);
    }
  }
  function derivePublicKey(secret) {
    const wasm = getWasm();
    return wasm.derivePubkey(secret);
  }
  function pointAddScalar(pubkey, scalar) {
    const wasm = getWasm();
    return wasm.pointAddScalar(pubkey, scalar);
  }
  function pointMultiply(pubkey, scalar) {
    const wasm = getWasm();
    return wasm.pointMultiply(pubkey, scalar);
  }
  function privateAdd(a, b) {
    const wasm = getWasm();
    return wasm.privateAdd(a, b);
  }
  function prepareMlsag(params) {
    const wasm = getWasm();
    const pcmInJson = JSON.stringify(params.vpInCommits.map(bytesToHex2));
    const pcmOutJson = JSON.stringify(params.vpOutCommits.map(bytesToHex2));
    const blindsJson = JSON.stringify(params.vpBlinds.map(bytesToHex2));
    const resultJson = wasm.prepareMlsag(
      bytesToHex2(params.m),
      params.nOuts,
      params.nBlinded,
      params.vpInCommitsLen,
      params.vpBlindsLen,
      params.nCols,
      params.nRows,
      pcmInJson,
      pcmOutJson,
      blindsJson
    );
    const result = JSON.parse(resultJson);
    return {
      m: hexToBytes2(result.m),
      sk: hexToBytes2(result.sk)
    };
  }
  function generateMlsag(params) {
    const wasm = getWasm();
    const skJson = JSON.stringify(params.secretKeys.map(bytesToHex2));
    const resultJson = wasm.generateMlsag(
      bytesToHex2(params.nonce),
      bytesToHex2(params.preimage),
      params.nCols,
      params.nRows,
      params.index,
      skJson,
      bytesToHex2(params.publicKeys)
    );
    const result = JSON.parse(resultJson);
    return {
      keyImages: hexToBytes2(result.keyImages),
      pc: hexToBytes2(result.pc),
      ps: hexToBytes2(result.ps)
    };
  }
  function verifyMlsag(params) {
    const wasm = getWasm();
    try {
      const resultJson = wasm.verifyMlsag(
        bytesToHex2(params.preimage),
        params.nCols,
        params.nRows,
        bytesToHex2(params.publicKeys),
        bytesToHex2(params.keyImages),
        bytesToHex2(params.pc),
        bytesToHex2(params.ps)
      );
      const result = JSON.parse(resultJson);
      return result.valid;
    } catch (error) {
      const errorStr = String(error);
      const errorMsg = error instanceof Error ? error.message : errorStr;
      console.error("[verifyMlsag] WASM call failed");
      console.error("[verifyMlsag] Error type:", typeof error);
      console.error("[verifyMlsag] Error:", error);
      console.error("[verifyMlsag] Error string:", errorStr);
      console.error("[verifyMlsag] Error message:", errorMsg);
      if (error instanceof Error) {
        console.error("[verifyMlsag] Error name:", error.name);
        console.error("[verifyMlsag] Error stack:", error.stack);
      }
      throw new Error(`MLSAG verification failed: ${errorMsg}`);
    }
  }
  function ecdsaSign(messageHash, secretKey) {
    const wasm = getWasm();
    return wasm.ecdsaSign(messageHash, secretKey);
  }
  function ecdsaSignCompact(messageHash, secretKey) {
    const wasm = getWasm();
    return wasm.ecdsaSignCompact(messageHash, secretKey);
  }
  function hexToBytes2(hex) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
    }
    return bytes;
  }
  function bytesToHex2(bytes) {
    return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  var wasmModule;
  var init_wasm = __esm({
    "src/wasm.ts"() {
      "use strict";
      init_debug();
      wasmModule = null;
    }
  });

  // debug-ui/src/browser.ts
  var browser_exports = {};
  __export(browser_exports, {
    ANON_MARKER: () => ANON_MARKER2,
    BufferReader: () => BufferReader,
    CONSOLIDATION_THRESHOLD: () => CONSOLIDATION_THRESHOLD,
    CTxOutCT: () => CTxOutCT,
    CTxOutRingCT: () => CTxOutRingCT,
    CWatchOnlyTx: () => CWatchOnlyTx,
    CWatchOnlyTxWithIndex: () => CWatchOnlyTxWithIndex,
    DEFAULT_FEE_PER_KB: () => DEFAULT_FEE_PER_KB,
    DEFAULT_RING_SIZE: () => DEFAULT_RING_SIZE,
    DUST_THRESHOLD: () => DUST_THRESHOLD,
    DataOutputTypes: () => DataOutputTypes,
    InsufficientFundsError: () => InsufficientFundsError,
    InvalidAddressError: () => InvalidAddressError,
    MAX_ANON_INPUTS: () => MAX_ANON_INPUTS,
    MAX_RING_SIZE: () => MAX_RING_SIZE,
    MIN_RING_SIZE: () => MIN_RING_SIZE,
    OutputType: () => OutputType,
    RpcError: () => RpcError,
    RpcRequester: () => RpcRequester,
    SEQUENCE_FINAL: () => SEQUENCE_FINAL,
    SEQUENCE_RBF: () => SEQUENCE_RBF,
    SIGHASH_ALL: () => SIGHASH_ALL,
    TransactionBuilder: () => TransactionBuilder,
    TransactionBuilderError: () => TransactionBuilderError,
    TransactionType: () => TransactionType,
    WatchOnlyTxType: () => WatchOnlyTxType,
    bytesEqual: () => bytesEqual,
    bytesToHex: () => bytesToHex,
    calculateTransactionSize: () => calculateTransactionSize,
    canSpendOutput: () => canSpendOutput,
    computeCTSighash: () => computeCTSighash,
    concatBytes: () => concatBytes,
    createCommitment: () => createCommitment,
    createP2PKHScriptPubKey: () => createP2PKHScriptPubKey,
    createP2PKHScriptSig: () => createP2PKHScriptSig,
    createWallet: () => createWallet,
    debug: () => debug,
    debugBytes: () => debugBytes,
    decodeStealthAddress: () => decodeStealthAddress,
    default: () => browser_default,
    deriveCTSpendKey: () => deriveCTSpendKey,
    derivePublicKey: () => derivePublicKey2,
    deriveSpendKey: () => deriveSpendKey,
    deserializeTransaction: () => deserializeTransaction,
    doubleSha256: () => doubleSha256,
    ecdsaSign: () => ecdsaSign,
    ecdsaSignCompact: () => ecdsaSignCompact,
    encodeStealthAddress: () => encodeStealthAddress,
    extractP2PKHHash: () => extractP2PKHHash,
    fetchDecoyOutputs: () => fetchDecoyOutputs,
    formatAmount: () => formatAmount,
    generateEphemeralKeys: () => generateEphemeralKeys,
    generateKeyImage: () => generateKeyImage,
    generateMlsag: () => generateMlsag,
    generatePrivateKey: () => generatePrivateKey,
    generateRangeProof: () => generateRangeProof,
    generateStealthAddress: () => generateStealthAddress,
    getBalance: () => getBalance,
    getBalanceCT: () => getBalanceCT,
    getRandomBytes: () => getRandomBytes,
    getTotalBalance: () => getTotalBalance,
    hash160: () => hash160,
    hexToBytes: () => hexToBytes,
    initWasm: () => initWasm,
    isDebugEnabled: () => isDebugEnabled,
    isP2PKH: () => isP2PKH,
    isValidAddress: () => isValidAddress,
    isValidAmount: () => isValidAmount,
    isValidCommitment: () => isValidCommitment,
    isValidPublicKey: () => isValidPublicKey,
    isValidRingSize: () => isValidRingSize,
    isValidSecretKey: () => isValidSecretKey,
    isValidStealthAddress: () => isValidStealthAddress,
    parseWatchOnlyTransactions: () => parseWatchOnlyTransactions,
    parseWatchOnlyTransactionsCT: () => parseWatchOnlyTransactionsCT,
    performEcdh: () => performEcdh,
    pointAddScalar: () => pointAddScalar2,
    pointMultiply: () => pointMultiply2,
    privateAdd: () => privateAdd2,
    privateSub: () => privateSub,
    randomBytes: () => randomBytes,
    randomSample: () => randomSample,
    restoreWallet: () => restoreWallet,
    rewindRangeProof: () => rewindRangeProof,
    ripemd160: () => ripemd160,
    satoshisToVeil: () => satoshisToVeil,
    scanBlock: () => scanBlock,
    scanCTOutput: () => scanCTOutput,
    scanOutput: () => scanOutput,
    scanRingCTOutput: () => scanRingCTOutput,
    scanTransaction: () => scanTransaction,
    scannedOutputToUTXO: () => scannedOutputToUTXO,
    serializeCTInput: () => serializeCTInput,
    serializeOutput: () => serializeOutput,
    serializeOutputData: () => serializeOutputData,
    serializeTransaction: () => serializeTransaction,
    setDebug: () => setDebug,
    sha256: () => sha256,
    shuffleArray: () => shuffleArray,
    sleep: () => sleep,
    stealthSecret: () => stealthSecret,
    validateAddress: () => validateAddress,
    veilToSatoshis: () => veilToSatoshis,
    verifyMlsag: () => verifyMlsag,
    verifyRangeProof: () => verifyRangeProof
  });

  // src/index.ts
  var src_exports = {};
  __export(src_exports, {
    ANON_MARKER: () => ANON_MARKER2,
    BufferReader: () => BufferReader,
    CONSOLIDATION_THRESHOLD: () => CONSOLIDATION_THRESHOLD,
    CTxOutCT: () => CTxOutCT,
    CTxOutRingCT: () => CTxOutRingCT,
    CWatchOnlyTx: () => CWatchOnlyTx,
    CWatchOnlyTxWithIndex: () => CWatchOnlyTxWithIndex,
    DEFAULT_FEE_PER_KB: () => DEFAULT_FEE_PER_KB,
    DEFAULT_RING_SIZE: () => DEFAULT_RING_SIZE,
    DUST_THRESHOLD: () => DUST_THRESHOLD,
    DataOutputTypes: () => DataOutputTypes,
    InsufficientFundsError: () => InsufficientFundsError,
    InvalidAddressError: () => InvalidAddressError,
    MAX_ANON_INPUTS: () => MAX_ANON_INPUTS,
    MAX_RING_SIZE: () => MAX_RING_SIZE,
    MIN_RING_SIZE: () => MIN_RING_SIZE,
    OutputType: () => OutputType,
    RpcError: () => RpcError,
    RpcRequester: () => RpcRequester,
    SEQUENCE_FINAL: () => SEQUENCE_FINAL,
    SEQUENCE_RBF: () => SEQUENCE_RBF,
    SIGHASH_ALL: () => SIGHASH_ALL,
    TransactionBuilder: () => TransactionBuilder,
    TransactionBuilderError: () => TransactionBuilderError,
    TransactionType: () => TransactionType,
    WatchOnlyTxType: () => WatchOnlyTxType,
    bytesEqual: () => bytesEqual,
    bytesToHex: () => bytesToHex,
    calculateTransactionSize: () => calculateTransactionSize,
    canSpendOutput: () => canSpendOutput,
    computeCTSighash: () => computeCTSighash,
    concatBytes: () => concatBytes,
    createCommitment: () => createCommitment,
    createP2PKHScriptPubKey: () => createP2PKHScriptPubKey,
    createP2PKHScriptSig: () => createP2PKHScriptSig,
    createWallet: () => createWallet,
    debug: () => debug,
    debugBytes: () => debugBytes,
    decodeStealthAddress: () => decodeStealthAddress,
    deriveCTSpendKey: () => deriveCTSpendKey,
    derivePublicKey: () => derivePublicKey2,
    deriveSpendKey: () => deriveSpendKey,
    deserializeTransaction: () => deserializeTransaction,
    doubleSha256: () => doubleSha256,
    ecdsaSign: () => ecdsaSign,
    ecdsaSignCompact: () => ecdsaSignCompact,
    encodeStealthAddress: () => encodeStealthAddress,
    extractP2PKHHash: () => extractP2PKHHash,
    fetchDecoyOutputs: () => fetchDecoyOutputs,
    formatAmount: () => formatAmount,
    generateEphemeralKeys: () => generateEphemeralKeys,
    generateKeyImage: () => generateKeyImage,
    generateMlsag: () => generateMlsag,
    generatePrivateKey: () => generatePrivateKey,
    generateRangeProof: () => generateRangeProof,
    generateStealthAddress: () => generateStealthAddress,
    getBalance: () => getBalance,
    getBalanceCT: () => getBalanceCT,
    getRandomBytes: () => getRandomBytes,
    getTotalBalance: () => getTotalBalance,
    hash160: () => hash160,
    hexToBytes: () => hexToBytes,
    initWasm: () => initWasm,
    isDebugEnabled: () => isDebugEnabled,
    isP2PKH: () => isP2PKH,
    isValidAddress: () => isValidAddress,
    isValidAmount: () => isValidAmount,
    isValidCommitment: () => isValidCommitment,
    isValidPublicKey: () => isValidPublicKey,
    isValidRingSize: () => isValidRingSize,
    isValidSecretKey: () => isValidSecretKey,
    isValidStealthAddress: () => isValidStealthAddress,
    parseWatchOnlyTransactions: () => parseWatchOnlyTransactions,
    parseWatchOnlyTransactionsCT: () => parseWatchOnlyTransactionsCT,
    performEcdh: () => performEcdh,
    pointAddScalar: () => pointAddScalar2,
    pointMultiply: () => pointMultiply2,
    privateAdd: () => privateAdd2,
    privateSub: () => privateSub,
    randomBytes: () => randomBytes,
    randomSample: () => randomSample,
    restoreWallet: () => restoreWallet,
    rewindRangeProof: () => rewindRangeProof,
    ripemd160: () => ripemd160,
    satoshisToVeil: () => satoshisToVeil,
    scanBlock: () => scanBlock,
    scanCTOutput: () => scanCTOutput,
    scanOutput: () => scanOutput,
    scanRingCTOutput: () => scanRingCTOutput,
    scanTransaction: () => scanTransaction,
    scannedOutputToUTXO: () => scannedOutputToUTXO,
    serializeCTInput: () => serializeCTInput,
    serializeOutput: () => serializeOutput,
    serializeOutputData: () => serializeOutputData,
    serializeTransaction: () => serializeTransaction,
    setDebug: () => setDebug,
    sha256: () => sha256,
    shuffleArray: () => shuffleArray,
    sleep: () => sleep,
    stealthSecret: () => stealthSecret,
    validateAddress: () => validateAddress,
    veilToSatoshis: () => veilToSatoshis,
    verifyMlsag: () => verifyMlsag,
    verifyRangeProof: () => verifyRangeProof
  });

  // src/types.ts
  var OutputType = /* @__PURE__ */ ((OutputType2) => {
    OutputType2[OutputType2["OUTPUT_NULL"] = 0] = "OUTPUT_NULL";
    OutputType2[OutputType2["OUTPUT_STANDARD"] = 1] = "OUTPUT_STANDARD";
    OutputType2[OutputType2["OUTPUT_CT"] = 2] = "OUTPUT_CT";
    OutputType2[OutputType2["OUTPUT_RINGCT"] = 3] = "OUTPUT_RINGCT";
    OutputType2[OutputType2["OUTPUT_DATA"] = 4] = "OUTPUT_DATA";
    return OutputType2;
  })(OutputType || {});
  var DataOutputTypes = /* @__PURE__ */ ((DataOutputTypes2) => {
    DataOutputTypes2[DataOutputTypes2["DO_NARR_PLAIN"] = 1] = "DO_NARR_PLAIN";
    DataOutputTypes2[DataOutputTypes2["DO_NARR_CRYPT"] = 2] = "DO_NARR_CRYPT";
    DataOutputTypes2[DataOutputTypes2["DO_STEALTH"] = 3] = "DO_STEALTH";
    DataOutputTypes2[DataOutputTypes2["DO_STEALTH_PREFIX"] = 4] = "DO_STEALTH_PREFIX";
    DataOutputTypes2[DataOutputTypes2["DO_VOTE"] = 5] = "DO_VOTE";
    DataOutputTypes2[DataOutputTypes2["DO_FEE"] = 6] = "DO_FEE";
    DataOutputTypes2[DataOutputTypes2["DO_DEV_FUND_CFWD"] = 7] = "DO_DEV_FUND_CFWD";
    DataOutputTypes2[DataOutputTypes2["DO_FUND_MSG"] = 8] = "DO_FUND_MSG";
    return DataOutputTypes2;
  })(DataOutputTypes || {});
  var TransactionType = /* @__PURE__ */ ((TransactionType2) => {
    TransactionType2[TransactionType2["STANDARD"] = 0] = "STANDARD";
    TransactionType2[TransactionType2["COINBASE"] = 1] = "COINBASE";
    TransactionType2[TransactionType2["COINSTAKE"] = 2] = "COINSTAKE";
    return TransactionType2;
  })(TransactionType || {});
  var TransactionBuilderError = class extends Error {
    constructor(message, code) {
      super(message);
      this.code = code;
      this.name = "TransactionBuilderError";
    }
  };
  var InsufficientFundsError = class extends TransactionBuilderError {
    constructor(required, available) {
      super(
        `Insufficient funds: required ${required}, available ${available}`,
        "INSUFFICIENT_FUNDS"
      );
      this.name = "InsufficientFundsError";
    }
  };
  var InvalidAddressError = class extends TransactionBuilderError {
    constructor(address) {
      super(`Invalid stealth address: ${address}`, "INVALID_ADDRESS");
      this.name = "InvalidAddressError";
    }
  };
  var RpcError = class extends TransactionBuilderError {
    constructor(message, statusCode) {
      super(message, "RPC_ERROR");
      this.statusCode = statusCode;
      this.name = "RpcError";
    }
  };

  // src/utils.ts
  function hexToBytes(hex) {
    const cleanHex = hex.startsWith("0x") ? hex.slice(2) : hex;
    if (cleanHex.length % 2 !== 0) {
      throw new Error("Invalid hex string: odd length");
    }
    const bytes = new Uint8Array(cleanHex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(cleanHex.substr(i * 2, 2), 16);
    }
    return bytes;
  }
  function bytesToHex(bytes) {
    return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  function isValidStealthAddress(address) {
    if (!address.startsWith("sv1")) {
      return false;
    }
    if (address.length < 95 || address.length > 122) {
      return false;
    }
    const validChars = /^sv1[ac-hj-np-z02-9]+$/;
    return validChars.test(address);
  }
  function encodeStealthAddress(scanPubkey, spendPubkey) {
    throw new Error("Stealth address encoding not yet implemented");
  }
  function veilToSatoshis(veil) {
    const SATOSHIS_PER_VEIL = 100000000n;
    return BigInt(Math.floor(veil * Number(SATOSHIS_PER_VEIL)));
  }
  function satoshisToVeil(satoshis) {
    const SATOSHIS_PER_VEIL = 100000000n;
    return Number(satoshis) / Number(SATOSHIS_PER_VEIL);
  }
  function formatAmount(satoshis, decimals = 8) {
    const veil = satoshisToVeil(satoshis);
    return veil.toFixed(decimals) + " VEIL";
  }
  function shuffleArray(array) {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
  function randomSample(array, count) {
    if (count > array.length) {
      throw new Error(`Cannot sample ${count} elements from array of length ${array.length}`);
    }
    const shuffled = shuffleArray(array);
    return shuffled.slice(0, count);
  }
  function concatBytes(...arrays) {
    const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const arr of arrays) {
      result.set(arr, offset);
      offset += arr.length;
    }
    return result;
  }
  function bytesEqual(a, b) {
    if (a.length !== b.length) {
      return false;
    }
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) {
        return false;
      }
    }
    return true;
  }
  function randomBytes(length) {
    const bytes = new Uint8Array(length);
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
      crypto.getRandomValues(bytes);
    } else {
      const nodeCrypto = __require("crypto");
      const buffer = nodeCrypto.randomBytes(length);
      bytes.set(new Uint8Array(buffer));
    }
    return bytes;
  }
  function isValidAmount(amount) {
    const MAX_AMOUNT = 21000000n * 100000000n;
    return amount > 0n && amount <= MAX_AMOUNT;
  }
  function isValidRingSize(ringSize) {
    return ringSize >= 3 && ringSize <= 32;
  }
  function isValidPublicKey(pubkey) {
    return pubkey.length === 33 && (pubkey[0] === 2 || pubkey[0] === 3);
  }
  function isValidSecretKey(seckey) {
    return seckey.length === 32;
  }
  function isValidCommitment(commitment) {
    return commitment.length === 33 && (commitment[0] === 8 || commitment[0] === 9);
  }
  function debugBytes(label, bytes, maxLen = 16) {
    const hex = bytesToHex(bytes);
    const preview = hex.length > maxLen * 2 ? hex.slice(0, maxLen * 2) + "..." : hex;
    return `${label}: ${preview} (${bytes.length} bytes)`;
  }
  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // src/index.ts
  init_debug();

  // src/crypto.ts
  init_wasm();
  var CURVE_ORDER = BigInt("0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141");
  function derivePublicKey2(privateKey) {
    return derivePublicKey(privateKey);
  }
  function pointAddScalar2(pubkey, scalar) {
    return pointAddScalar(pubkey, scalar);
  }
  function pointMultiply2(pubkey, scalar) {
    return pointMultiply(pubkey, scalar);
  }
  function privateAdd2(a, b) {
    return privateAdd(a, b);
  }
  function privateSub(a, b) {
    const aBig = BigInt("0x" + bytesToHex(a));
    const bBig = BigInt("0x" + bytesToHex(b));
    const diff = (aBig - bBig + CURVE_ORDER) % CURVE_ORDER;
    const hex = diff.toString(16).padStart(64, "0");
    return hexToBytes(hex);
  }
  async function sha256(data) {
    if (typeof crypto !== "undefined" && crypto.subtle) {
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      return new Uint8Array(hashBuffer);
    }
    const nodeCrypto = __require("crypto");
    const hash = nodeCrypto.createHash("sha256");
    hash.update(data);
    return new Uint8Array(hash.digest());
  }
  async function doubleSha256(data) {
    const hash1 = await sha256(data);
    return sha256(hash1);
  }
  function ripemd160(data) {
    const nodeCrypto = __require("crypto");
    const hash = nodeCrypto.createHash("ripemd160");
    hash.update(data);
    return new Uint8Array(hash.digest());
  }
  async function hash160(data) {
    const sha = await sha256(data);
    return ripemd160(sha);
  }
  function getRandomBytes(length) {
    const bytes = new Uint8Array(length);
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
      crypto.getRandomValues(bytes);
    } else {
      const nodeCrypto = __require("crypto");
      const buffer = nodeCrypto.randomBytes(length);
      bytes.set(new Uint8Array(buffer));
    }
    return bytes;
  }
  function generatePrivateKey() {
    while (true) {
      const key = getRandomBytes(32);
      const keyBig = BigInt("0x" + bytesToHex(key));
      if (keyBig > 0n && keyBig < CURVE_ORDER) {
        return key;
      }
    }
  }

  // src/stealth.ts
  init_wasm();
  var EC_COMPRESSED_SIZE = 33;
  function generateStealthAddress(scanPubkey, spendPubkey, options = {}) {
    if (!isValidPublicKey(scanPubkey)) {
      throw new Error("Invalid scan public key");
    }
    if (!isValidPublicKey(spendPubkey)) {
      throw new Error("Invalid spend public key");
    }
    const opts = {
      options: options.options ?? 0,
      numberSignatures: options.numberSignatures ?? 0,
      prefixNumberBits: options.prefixNumberBits ?? 0,
      prefixBitfield: options.prefixBitfield ?? 0
    };
    const buffer = new Uint8Array(512);
    let offset = 0;
    buffer[offset++] = opts.options;
    buffer.set(scanPubkey, offset);
    offset += EC_COMPRESSED_SIZE;
    buffer[offset++] = 1;
    buffer.set(spendPubkey, offset);
    offset += EC_COMPRESSED_SIZE;
    buffer[offset++] = opts.numberSignatures;
    buffer[offset++] = opts.prefixNumberBits;
    const prefixBytes = Math.ceil(opts.prefixNumberBits / 8);
    if (prefixBytes >= 1) {
      const view = new DataView(buffer.buffer);
      view.setUint32(offset, opts.prefixBitfield, false);
      offset += 4;
    }
    const data = buffer.slice(0, offset);
    return encodeBech32StealthAddress(data);
  }
  function getVeilBech32Constant() {
    return 1;
  }
  function decodeStealthAddress(address) {
    if (!address.startsWith("sv1")) {
      throw new Error("Invalid stealth address: must start with sv1");
    }
    const data = decodeBech32StealthAddress(address);
    let offset = 0;
    const options = data[offset++];
    const scanPubkey = data.slice(offset, offset + EC_COMPRESSED_SIZE);
    offset += EC_COMPRESSED_SIZE;
    const numSpendPubkeys = data[offset++];
    const spendPubkey = data.slice(offset, offset + EC_COMPRESSED_SIZE * numSpendPubkeys);
    offset += EC_COMPRESSED_SIZE * numSpendPubkeys;
    const numberSignatures = data[offset++];
    const prefixNumberBits = data[offset++];
    let prefixBitfield = 0;
    const prefixBytes = Math.ceil(prefixNumberBits / 8);
    if (prefixBytes >= 1) {
      const view = new DataView(data.buffer, data.byteOffset);
      prefixBitfield = view.getUint32(offset, false);
    }
    return {
      scanPubkey,
      spendPubkey,
      options,
      numberSignatures,
      prefixNumberBits,
      prefixBitfield
    };
  }
  async function generateEphemeralKeys(recipientAddress) {
    const { scanPubkey, spendPubkey } = decodeStealthAddress(recipientAddress);
    const ephemeralSecret = getRandomBytes(32);
    const ephemeralPubkey = await derivePublicKeyFromSecret(ephemeralSecret);
    const sharedSecret = performEcdh(scanPubkey, ephemeralSecret);
    const destPubkey = await deriveDestinationKey(spendPubkey, sharedSecret);
    return {
      ephemeralPubkey,
      sharedSecret,
      destPubkey,
      ephemeralSecret
    };
  }
  async function deriveDestinationKey(spendPubkey, sharedSecret) {
    return pointAddScalar2(spendPubkey, sharedSecret);
  }
  function deriveSpendKey(spendSecret, sharedSecret) {
    return privateAdd2(spendSecret, sharedSecret);
  }
  async function stealthSecret(ephemeralSecret, scanPubkey, spendPubkey) {
    if (scanPubkey.length !== EC_COMPRESSED_SIZE) {
      throw new Error("scanPubkey must be 33 bytes (compressed)");
    }
    if (spendPubkey.length !== EC_COMPRESSED_SIZE) {
      throw new Error("spendPubkey must be 33 bytes (compressed)");
    }
    const sharedSecret = performEcdh(scanPubkey, ephemeralSecret);
    const destPubkey = await deriveDestinationKey(spendPubkey, sharedSecret);
    return { sharedSecret, destPubkey };
  }
  function encodeBech32StealthAddress(data) {
    const words = convertBits(data, 8, 5, true);
    const encoded = bech32Encode("sv", Array.from(words), getVeilBech32Constant());
    return encoded;
  }
  function decodeBech32StealthAddress(address) {
    const { prefix, words } = bech32Decode(address, getVeilBech32Constant());
    if (prefix !== "sv") {
      throw new Error("Invalid stealth address prefix");
    }
    const data = convertBits(new Uint8Array(words), 5, 8, false);
    return data;
  }
  function convertBits(data, fromBits, toBits, pad) {
    let acc = 0;
    let bits = 0;
    const result = [];
    const maxv = (1 << toBits) - 1;
    for (let i = 0; i < data.length; i++) {
      const value = data[i];
      if (value < 0 || value >> fromBits !== 0) {
        throw new Error("Invalid data");
      }
      acc = acc << fromBits | value;
      bits += fromBits;
      while (bits >= toBits) {
        bits -= toBits;
        result.push(acc >> bits & maxv);
      }
    }
    if (pad) {
      if (bits > 0) {
        result.push(acc << toBits - bits & maxv);
      }
    } else if (bits >= fromBits || acc << toBits - bits & maxv) {
      throw new Error("Invalid padding");
    }
    return new Uint8Array(result);
  }
  var CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";
  function polymod(values) {
    let chk = 1;
    const GEN = [996825010, 642813549, 513874426, 1027748829, 705979059];
    for (const value of values) {
      const b = chk >> 25;
      chk = (chk & 33554431) << 5 ^ value;
      for (let i = 0; i < 5; i++) {
        if (b >> i & 1) {
          chk ^= GEN[i];
        }
      }
    }
    return chk;
  }
  function hrpExpand(hrp) {
    const result = [];
    for (let i = 0; i < hrp.length; i++) {
      result.push(hrp.charCodeAt(i) >> 5);
    }
    result.push(0);
    for (let i = 0; i < hrp.length; i++) {
      result.push(hrp.charCodeAt(i) & 31);
    }
    return result;
  }
  function createChecksum(hrp, data, encodingConst) {
    const values = hrpExpand(hrp).concat(data).concat([0, 0, 0, 0, 0, 0]);
    const mod = polymod(values) ^ encodingConst;
    const result = [];
    for (let i = 0; i < 6; i++) {
      result.push(mod >> 5 * (5 - i) & 31);
    }
    return result;
  }
  function bech32Encode(hrp, data, encodingConst) {
    const combined = Array.from(data).concat(createChecksum(hrp, Array.from(data), encodingConst));
    let result = hrp + "1";
    for (const d of combined) {
      result += CHARSET.charAt(d);
    }
    return result;
  }
  function bech32Decode(str, encodingConst) {
    if (str.toLowerCase() !== str && str.toUpperCase() !== str) {
      throw new Error("Mixed case string");
    }
    str = str.toLowerCase();
    const pos = str.lastIndexOf("1");
    if (pos < 1 || pos + 7 > str.length || str.length > 122) {
      throw new Error("Invalid bech32 string");
    }
    const hrp = str.substring(0, pos);
    const data = [];
    for (let i = pos + 1; i < str.length; i++) {
      const d = CHARSET.indexOf(str.charAt(i));
      if (d === -1) {
        throw new Error("Invalid bech32 character");
      }
      data.push(d);
    }
    if (!verifyChecksum(hrp, data, encodingConst)) {
      throw new Error("Invalid bech32 checksum");
    }
    return { prefix: hrp, words: data.slice(0, -6) };
  }
  function verifyChecksum(hrp, data, encodingConst) {
    return polymod(hrpExpand(hrp).concat(data)) === encodingConst;
  }
  async function derivePublicKeyFromSecret(secret) {
    return derivePublicKey2(secret);
  }
  function createWallet() {
    const spendSecret = getRandomBytes(32);
    const scanSecret = getRandomBytes(32);
    const spendPubkey = derivePublicKey2(spendSecret);
    const scanPubkey = derivePublicKey2(scanSecret);
    const stealthAddress = generateStealthAddress(scanPubkey, spendPubkey);
    return {
      spendSecret,
      scanSecret,
      spendPubkey,
      scanPubkey,
      stealthAddress,
      spendSecretHex: bytesToHex(spendSecret),
      scanSecretHex: bytesToHex(scanSecret)
    };
  }
  function restoreWallet(spendSecret, scanSecret) {
    const spendSecretBytes = typeof spendSecret === "string" ? hexToBytes(spendSecret) : spendSecret;
    const scanSecretBytes = typeof scanSecret === "string" ? hexToBytes(scanSecret) : scanSecret;
    if (!isValidSecretKey(spendSecretBytes)) {
      throw new Error("Invalid spend secret key");
    }
    if (!isValidSecretKey(scanSecretBytes)) {
      throw new Error("Invalid scan secret key");
    }
    const spendPubkey = derivePublicKey2(spendSecretBytes);
    const scanPubkey = derivePublicKey2(scanSecretBytes);
    const stealthAddress = generateStealthAddress(scanPubkey, spendPubkey);
    return {
      spendSecret: spendSecretBytes,
      scanSecret: scanSecretBytes,
      spendPubkey,
      scanPubkey,
      stealthAddress,
      spendSecretHex: bytesToHex(spendSecretBytes),
      scanSecretHex: bytesToHex(scanSecretBytes)
    };
  }
  function validateAddress(address) {
    if (typeof address !== "string") {
      return {
        valid: false,
        error: "Address must be a string"
      };
    }
    if (address.length === 0) {
      return {
        valid: false,
        error: "Address cannot be empty"
      };
    }
    if (!address.startsWith("sv1")) {
      return {
        valid: false,
        error: 'Invalid address prefix. Veil stealth addresses start with "sv1"'
      };
    }
    if (address.length < 60) {
      return {
        valid: false,
        error: "Address too short. Veil stealth addresses are longer."
      };
    }
    try {
      const decoded = decodeStealthAddress(address);
      if (!isValidPublicKey(decoded.scanPubkey)) {
        return {
          valid: false,
          error: "Invalid scan public key in address"
        };
      }
      if (!isValidPublicKey(decoded.spendPubkey)) {
        return {
          valid: false,
          error: "Invalid spend public key in address"
        };
      }
      return {
        valid: true,
        details: {
          prefix: "sv1",
          scanPubkey: decoded.scanPubkey,
          spendPubkey: decoded.spendPubkey
        }
      };
    } catch (error) {
      return {
        valid: false,
        error: `Invalid address format: ${error.message}`
      };
    }
  }
  function isValidAddress(address) {
    return validateAddress(address).valid;
  }

  // src/serialization.ts
  init_debug();
  var ANON_MARKER = 4294967200;
  function serializeVarInt(n) {
    const num = typeof n === "bigint" ? Number(n) : n;
    if (num < 253) {
      return new Uint8Array([num]);
    } else if (num <= 65535) {
      const buf = new Uint8Array(3);
      buf[0] = 253;
      buf[1] = num & 255;
      buf[2] = num >> 8 & 255;
      return buf;
    } else if (num <= 4294967295) {
      const buf = new Uint8Array(5);
      buf[0] = 254;
      buf[1] = num & 255;
      buf[2] = num >> 8 & 255;
      buf[3] = num >> 16 & 255;
      buf[4] = num >> 24 & 255;
      return buf;
    } else {
      const buf = new Uint8Array(9);
      buf[0] = 255;
      const bigN = BigInt(num);
      for (let i = 0; i < 8; i++) {
        buf[i + 1] = Number(bigN >> BigInt(i * 8) & 0xffn);
      }
      return buf;
    }
  }
  function serializeUInt32LE(n) {
    const buf = new Uint8Array(4);
    buf[0] = n & 255;
    buf[1] = n >> 8 & 255;
    buf[2] = n >> 16 & 255;
    buf[3] = n >> 24 & 255;
    return buf;
  }
  function serializeUInt64LE(n) {
    const buf = new Uint8Array(8);
    for (let i = 0; i < 8; i++) {
      buf[i] = Number(n >> BigInt(i * 8) & 0xffn);
    }
    return buf;
  }
  function serializeVector(data) {
    return concatBytes(serializeVarInt(data.length), data);
  }
  function serializeStack(stack) {
    const parts = [serializeVarInt(stack.length)];
    for (const item of stack) {
      parts.push(serializeVarInt(item.length));
      parts.push(item);
    }
    return concatBytes(...parts);
  }
  function serializeInput(input) {
    const parts = [];
    parts.push(input.prevout.hash);
    parts.push(serializeUInt32LE(input.prevout.n));
    parts.push(serializeVector(input.scriptSig));
    parts.push(serializeUInt32LE(input.nSequence));
    if (input.prevout.n === ANON_MARKER && input.scriptData) {
      debug(`[serializeInput] Writing scriptData for anon input:`);
      debug(`  scriptData.stack.length: ${input.scriptData.stack.length}`);
      const stackSerialized = serializeStack(input.scriptData.stack);
      debug(`  Serialized stack size: ${stackSerialized.length} bytes`);
      parts.push(stackSerialized);
    }
    return concatBytes(...parts);
  }
  function serializeOutputData(output) {
    const parts = [];
    switch (output.type) {
      case 1 /* OUTPUT_STANDARD */:
        if ("scriptPubKey" in output) {
          parts.push(serializeUInt64LE(output.amount));
          parts.push(serializeVector(output.scriptPubKey));
        }
        break;
      case 2 /* OUTPUT_CT */:
        if ("commitment" in output && "vData" in output && "scriptPubKey" in output && "vRangeproof" in output) {
          parts.push(output.commitment);
          parts.push(serializeVector(output.vData));
          parts.push(serializeVector(output.scriptPubKey));
          parts.push(serializeVector(output.vRangeproof));
        }
        break;
      case 3 /* OUTPUT_RINGCT */:
        if ("pk" in output && "commitment" in output && "vData" in output && "vRangeproof" in output) {
          parts.push(output.pk);
          parts.push(output.commitment);
          parts.push(serializeVector(output.vData));
          parts.push(serializeVector(output.vRangeproof));
        }
        break;
      case 4 /* OUTPUT_DATA */:
        if ("vData" in output) {
          parts.push(serializeVector(output.vData));
        }
        break;
      default:
        throw new Error(`Unsupported output type: ${output.type}`);
    }
    return concatBytes(...parts);
  }
  function serializeOutput(output) {
    const typeByte = new Uint8Array([output.type]);
    const data = serializeOutputData(output);
    return concatBytes(typeByte, data);
  }
  function serializeTransaction(tx) {
    const parts = [];
    const version = tx.version || 2;
    const txType = tx.txType || 0 /* STANDARD */;
    const nVersion = txType << 8 | version;
    parts.push(new Uint8Array([nVersion & 255]));
    parts.push(new Uint8Array([nVersion >> 8 & 255]));
    parts.push(new Uint8Array([tx.hasWitness ? 1 : 0]));
    parts.push(serializeUInt32LE(tx.lockTime || 0));
    parts.push(serializeVarInt(tx.inputs.length));
    for (const input of tx.inputs) {
      parts.push(serializeInput(input));
    }
    parts.push(serializeVarInt(tx.outputs.length));
    for (const output of tx.outputs) {
      parts.push(serializeOutput(output));
    }
    if (tx.hasWitness && tx.witness) {
      for (const scriptWitness of tx.witness.scriptWitness) {
        parts.push(serializeStack(scriptWitness.stack));
      }
    }
    const serialized = concatBytes(...parts);
    return Array.from(serialized).map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  function deserializeVarInt(bytes, offset) {
    const first = bytes[offset.value++];
    if (first < 253) {
      return first;
    } else if (first === 253) {
      const value = bytes[offset.value] | bytes[offset.value + 1] << 8;
      offset.value += 2;
      return value;
    } else if (first === 254) {
      const value = bytes[offset.value] | bytes[offset.value + 1] << 8 | bytes[offset.value + 2] << 16 | bytes[offset.value + 3] << 24;
      offset.value += 4;
      return value >>> 0;
    } else {
      let value = 0;
      for (let i = 0; i < 8; i++) {
        value |= bytes[offset.value + i] << i * 8;
      }
      offset.value += 8;
      return value;
    }
  }
  function deserializeUInt32LE(bytes, offset) {
    const value = bytes[offset.value] | bytes[offset.value + 1] << 8 | bytes[offset.value + 2] << 16 | bytes[offset.value + 3] << 24;
    offset.value += 4;
    return value >>> 0;
  }
  function deserializeUInt64LE(bytes, offset) {
    let value = 0n;
    for (let i = 0; i < 8; i++) {
      value |= BigInt(bytes[offset.value + i]) << BigInt(i * 8);
    }
    offset.value += 8;
    return value;
  }
  function deserializeBytes(bytes, offset, n) {
    const result = bytes.slice(offset.value, offset.value + n);
    offset.value += n;
    return result;
  }
  function deserializeVector(bytes, offset) {
    const length = deserializeVarInt(bytes, offset);
    return deserializeBytes(bytes, offset, length);
  }
  function deserializeStack(bytes, offset) {
    const count = deserializeVarInt(bytes, offset);
    const stack = [];
    for (let i = 0; i < count; i++) {
      stack.push(deserializeVector(bytes, offset));
    }
    return stack;
  }
  function deserializeTransaction(hex) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
    }
    const offset = { value: 0 };
    const versionLow = bytes[offset.value++];
    const versionHigh = bytes[offset.value++];
    const nVersion = versionLow | versionHigh << 8;
    const version = nVersion & 255;
    const txType = nVersion >> 8 & 255;
    const hasWitness = bytes[offset.value++] === 1;
    const lockTime = deserializeUInt32LE(bytes, offset);
    const numInputs = deserializeVarInt(bytes, offset);
    const inputs = [];
    for (let i = 0; i < numInputs; i++) {
      const hash = deserializeBytes(bytes, offset, 32);
      const n = deserializeUInt32LE(bytes, offset);
      const scriptSig = deserializeVector(bytes, offset);
      const nSequence = deserializeUInt32LE(bytes, offset);
      let scriptData;
      if (n === ANON_MARKER) {
        scriptData = { stack: deserializeStack(bytes, offset) };
      }
      inputs.push({
        prevout: { hash, n },
        scriptSig,
        nSequence,
        scriptData,
        ring: [],
        // Unknown when deserializing
        keyImage: new Uint8Array(33),
        // Will be in scriptData
        secretIndex: 0,
        secretKey: new Uint8Array(32)
      });
    }
    const numOutputs = deserializeVarInt(bytes, offset);
    const outputs = [];
    for (let i = 0; i < numOutputs; i++) {
      const outputType = bytes[offset.value++];
      switch (outputType) {
        case 1 /* OUTPUT_STANDARD */: {
          const amount = deserializeUInt64LE(bytes, offset);
          const scriptPubKey = deserializeVector(bytes, offset);
          outputs.push({
            type: 1 /* OUTPUT_STANDARD */,
            address: "",
            amount,
            scriptPubKey
          });
          break;
        }
        case 2 /* OUTPUT_CT */: {
          const commitment = deserializeBytes(bytes, offset, 33);
          const vData = deserializeVector(bytes, offset);
          const scriptPubKey = deserializeVector(bytes, offset);
          const vRangeproof = deserializeVector(bytes, offset);
          outputs.push({
            type: 2 /* OUTPUT_CT */,
            address: "",
            amount: 0n,
            // Hidden
            commitment,
            vData,
            scriptPubKey,
            vRangeproof
          });
          break;
        }
        case 3 /* OUTPUT_RINGCT */: {
          const pk = deserializeBytes(bytes, offset, 33);
          const commitment = deserializeBytes(bytes, offset, 33);
          const vData = deserializeVector(bytes, offset);
          const vRangeproof = deserializeVector(bytes, offset);
          outputs.push({
            type: 3 /* OUTPUT_RINGCT */,
            address: "",
            amount: 0n,
            // Hidden
            pk,
            commitment,
            vData,
            vRangeproof
          });
          break;
        }
        case 4 /* OUTPUT_DATA */: {
          const vData = deserializeVector(bytes, offset);
          outputs.push({
            type: 4 /* OUTPUT_DATA */,
            address: "",
            amount: 0n,
            vData
          });
          break;
        }
        default:
          throw new Error(`Unknown output type: ${outputType}`);
      }
    }
    let witness;
    if (hasWitness) {
      witness = { scriptWitness: [] };
      for (let i = 0; i < numInputs; i++) {
        witness.scriptWitness.push({
          stack: deserializeStack(bytes, offset)
        });
      }
    }
    return {
      version,
      txType,
      hasWitness,
      lockTime,
      inputs,
      outputs,
      ringSize: inputs[0]?.ring.length || 0,
      witness,
      fee: 0n
    };
  }
  function calculateTransactionSize(tx) {
    const hex = serializeTransaction(tx);
    return hex.length / 2;
  }

  // src/TransactionBuilder.ts
  init_debug();
  init_wasm();

  // src/ct-utils.ts
  var SIGHASH_ALL = 1;
  var SEQUENCE_FINAL = 4294967295;
  var SEQUENCE_RBF = 4294967294;
  async function createP2PKHScriptPubKey(pubkey) {
    const pubkeyHash = await hash160(pubkey);
    return concatBytes(
      new Uint8Array([118, 169, 20]),
      // OP_DUP OP_HASH160 PUSH20
      pubkeyHash,
      // 20-byte pubkey hash
      new Uint8Array([136, 172])
      // OP_EQUALVERIFY OP_CHECKSIG
    );
  }
  function createP2PKHScriptSig(signature, pubkey, sighashType = SIGHASH_ALL) {
    const sigWithHashType = concatBytes(signature, new Uint8Array([sighashType]));
    return concatBytes(
      new Uint8Array([sigWithHashType.length]),
      // PUSH sig length
      sigWithHashType,
      // signature + sighash type
      new Uint8Array([pubkey.length]),
      // PUSH pubkey length
      pubkey
      // pubkey
    );
  }
  function extractP2PKHHash(scriptPubKey) {
    if (scriptPubKey.length !== 25) return null;
    if (scriptPubKey[0] !== 118) return null;
    if (scriptPubKey[1] !== 169) return null;
    if (scriptPubKey[2] !== 20) return null;
    if (scriptPubKey[23] !== 136) return null;
    if (scriptPubKey[24] !== 172) return null;
    return scriptPubKey.slice(3, 23);
  }
  function isP2PKH(scriptPubKey) {
    return extractP2PKHHash(scriptPubKey) !== null;
  }
  async function computeCTSighash(tx, inputIndex, scriptPubKey, commitment, sighashType = SIGHASH_ALL) {
    const parts = [];
    const versionBytes = new Uint8Array(4);
    new DataView(versionBytes.buffer).setInt32(0, tx.version, true);
    parts.push(versionBytes);
    parts.push(encodeVarInt(tx.inputs.length));
    for (let i = 0; i < tx.inputs.length; i++) {
      const input = tx.inputs[i];
      parts.push(input.prevout.hash);
      const nBytes = new Uint8Array(4);
      new DataView(nBytes.buffer).setUint32(0, input.prevout.n, true);
      parts.push(nBytes);
      if (i === inputIndex) {
        parts.push(encodeVarInt(scriptPubKey.length));
        parts.push(scriptPubKey);
      } else {
        parts.push(new Uint8Array([0]));
      }
      const seqBytes = new Uint8Array(4);
      new DataView(seqBytes.buffer).setUint32(0, input.nSequence, true);
      parts.push(seqBytes);
    }
    parts.push(encodeVarInt(tx.outputs.length));
    const outputsData = await serializeOutputsForLegacySighash(tx.outputs);
    parts.push(outputsData);
    const locktimeBytes = new Uint8Array(4);
    new DataView(locktimeBytes.buffer).setUint32(0, tx.lockTime, true);
    parts.push(locktimeBytes);
    const sighashBytes = new Uint8Array(4);
    new DataView(sighashBytes.buffer).setInt32(0, sighashType, true);
    parts.push(sighashBytes);
    return doubleSha256(concatBytes(...parts));
  }
  async function serializeOutputsForLegacySighash(outputs) {
    const parts = [];
    for (const output of outputs) {
      switch (output.type) {
        case 3 /* OUTPUT_RINGCT */: {
          if ("pk" in output && "commitment" in output) {
            parts.push(output.pk);
            parts.push(output.commitment);
            parts.push(encodeVarInt(output.vData.length));
            parts.push(output.vData);
            parts.push(encodeVarInt(output.vRangeproof.length));
            parts.push(output.vRangeproof);
          }
          break;
        }
        case 2 /* OUTPUT_CT */: {
          if ("commitment" in output && "scriptPubKey" in output) {
            parts.push(output.commitment);
            parts.push(encodeVarInt(output.vData.length));
            parts.push(output.vData);
            parts.push(encodeVarInt(output.scriptPubKey.length));
            parts.push(output.scriptPubKey);
            parts.push(encodeVarInt(output.vRangeproof.length));
            parts.push(output.vRangeproof);
          }
          break;
        }
        case 4 /* OUTPUT_DATA */: {
          if ("vData" in output) {
            parts.push(encodeVarInt(output.vData.length));
            parts.push(output.vData);
          }
          break;
        }
        case 1 /* OUTPUT_STANDARD */: {
          if ("scriptPubKey" in output) {
            const valueBytes = new Uint8Array(8);
            new DataView(valueBytes.buffer).setBigInt64(0, output.amount, true);
            parts.push(valueBytes);
            parts.push(encodeVarInt(output.scriptPubKey.length));
            parts.push(output.scriptPubKey);
          }
          break;
        }
      }
    }
    return concatBytes(...parts);
  }
  function encodeVarInt(n) {
    if (n < 253) {
      return new Uint8Array([n]);
    } else if (n <= 65535) {
      const bytes = new Uint8Array(3);
      bytes[0] = 253;
      new DataView(bytes.buffer).setUint16(1, n, true);
      return bytes;
    } else if (n <= 4294967295) {
      const bytes = new Uint8Array(5);
      bytes[0] = 254;
      new DataView(bytes.buffer).setUint32(1, n, true);
      return bytes;
    } else {
      const bytes = new Uint8Array(9);
      bytes[0] = 255;
      new DataView(bytes.buffer).setBigUint64(1, BigInt(n), true);
      return bytes;
    }
  }
  function serializeCTInput(input) {
    const parts = [];
    parts.push(input.prevout.hash);
    const nBytes = new Uint8Array(4);
    new DataView(nBytes.buffer).setUint32(0, input.prevout.n, true);
    parts.push(nBytes);
    parts.push(encodeVarInt(input.scriptSig.length));
    parts.push(input.scriptSig);
    const seqBytes = new Uint8Array(4);
    new DataView(seqBytes.buffer).setUint32(0, input.nSequence, true);
    parts.push(seqBytes);
    return concatBytes(...parts);
  }
  async function deriveCTSpendKey(spendSecret, scanSecret, ephemeralPubkey) {
    const { performEcdh: performEcdh3, privateAdd: privateAdd3 } = await Promise.resolve().then(() => (init_wasm(), wasm_exports));
    const sharedSecret = performEcdh3(ephemeralPubkey, scanSecret);
    return privateAdd3(spendSecret, sharedSecret);
  }

  // src/range-proof-params.ts
  function countLeadingZeros(value) {
    let zeros = 0;
    let n = value;
    for (let i = 0; i < 64; i++, n >>= 1n) {
      if ((n & 1n) !== 0n) {
        break;
      }
      zeros++;
    }
    return zeros;
  }
  function countTrailingZeros(value) {
    let zeros = 0;
    let n = value;
    const mask = 1n << 63n;
    for (let i = 0; i < 64; i++, n <<= 1n) {
      if ((n & mask) !== 0n) {
        break;
      }
      zeros++;
    }
    return zeros;
  }
  function ipow(base, exp) {
    let result = 1n;
    let b = base;
    let e = exp;
    while (e > 0) {
      if (e & 1) {
        result *= b;
      }
      e >>= 1;
      b *= b;
    }
    return result;
  }
  function getRandomInt(max) {
    if (max <= 0) return 0;
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    return array[0] % max;
  }
  function selectRangeProofParameters(value) {
    if (value === 0n) {
      const exponent2 = getRandomInt(5);
      let minBits2 = 32;
      if (getRandomInt(10) === 0) {
        minBits2 += getRandomInt(5);
      }
      return {
        minValue: 0n,
        exponent: exponent2,
        minBits: minBits2
      };
    }
    const nLeadingZeros = countLeadingZeros(value);
    const nTrailingZeros = countTrailingZeros(value);
    let nBitsReq = 64 - nLeadingZeros - nTrailingZeros;
    let minBits = 32;
    let nTest = value;
    let nDiv10 = 0;
    while (nTest % 10n === 0n) {
      nDiv10++;
      nTest /= 10n;
    }
    const eMin = Math.floor(nDiv10 / 2);
    const exponent = eMin + getRandomInt(Math.max(1, nDiv10 - eMin));
    nTest = value / ipow(10n, exponent);
    const nTrailingZerosReduced = countTrailingZeros(nTest);
    nBitsReq = 64 - nTrailingZerosReduced;
    if (nBitsReq > 32) {
      minBits = nBitsReq;
    }
    while (minBits < 63 && minBits % 4 !== 0) {
      minBits++;
    }
    return {
      minValue: 0n,
      exponent,
      minBits
    };
  }
  function validateRangeProofParams(params) {
    if (params.exponent < 0 || params.exponent > 18) {
      return false;
    }
    if (params.minBits < 0 || params.minBits > 64) {
      return false;
    }
    if (params.minValue < 0n) {
      return false;
    }
    if (params.minBits > 0 && params.minBits < 63 && params.minBits % 4 !== 0) {
      console.warn("[validateRangeProofParams] minBits is not a multiple of 4, may be suboptimal");
    }
    return true;
  }

  // src/rpc.ts
  init_debug();
  var RpcRequester = class {
    /**
     * Send a raw RPC request
     *
     * @param method - RPC method name
     * @param params - Method parameters
     * @returns RPC result
     */
    static async send(method, params = []) {
      const id = ++this.requestId;
      const request = {
        jsonrpc: "2.0",
        id,
        method,
        params
      };
      const headers = {
        "Content-Type": "application/json"
      };
      if (this.NODE_PASSWORD) {
        const credentials = `${this.NODE_USERNAME}:${this.NODE_PASSWORD}`;
        const encoded = Buffer.from(credentials).toString("base64");
        headers["Authorization"] = `Basic ${encoded}`;
      }
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.TIMEOUT_MS);
        const response = await fetch(this.NODE_URL, {
          method: "POST",
          headers,
          body: JSON.stringify(request),
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const rpcResponse = await response.json();
        if (rpcResponse.error) {
          const error = new Error(
            `RPC Error ${rpcResponse.error.code}: ${rpcResponse.error.message}`
          );
          error.code = rpcResponse.error.code;
          error.data = rpcResponse.error.data;
          throw error;
        }
        if (rpcResponse.result === void 0) {
          throw new Error("RPC response missing result");
        }
        return rpcResponse.result;
      } catch (error) {
        if (error.name === "AbortError") {
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
    static async getAnonOutputs(inputSize, ringSize) {
      const params = [inputSize, ringSize];
      const result = await this.send("getanonoutputs", params);
      debug("[getAnonOutputs] Raw RPC response (first output):");
      debug(JSON.stringify(result[0], null, 2));
      return result.map((output, idx) => {
        const index = output.ringctindex !== void 0 ? output.ringctindex : output.index !== void 0 ? output.index : output.global_index !== void 0 ? output.global_index : 0;
        debug(`[getAnonOutputs] Output ${idx}: index=${index} (from RPC field: ${output.ringctindex !== void 0 ? "ringctindex" : output.index !== void 0 ? "index" : output.global_index !== void 0 ? "global_index" : "default 0"})`);
        return {
          pubkey: hexToBytes(output.pubkey),
          commitment: hexToBytes(output.commitment),
          index,
          txid: output.txid,
          vout: output.vout
        };
      });
    }
    /**
     * Send raw transaction to the network
     *
     * @param txHex - Serialized transaction (hex string)
     * @returns Transaction ID
     */
    static async sendRawTransaction(txHex) {
      return await this.send("sendrawtransaction", [txHex]);
    }
    /**
     * Get blockchain information
     *
     * @returns Blockchain state
     */
    static async getBlockchainInfo() {
      return await this.send("getblockchaininfo", []);
    }
    /**
     * Check if key images are spent
     *
     * @param keyImages - Array of key images to check
     * @returns Array of spent status for each key image
     */
    static async checkKeyImages(keyImages) {
      const keyImageHexArray = keyImages.map((ki) => bytesToHex(ki));
      const result = await this.send("checkkeyimages", [keyImageHexArray]);
      if (!Array.isArray(result)) {
        throw new Error("checkkeyimages: Expected array response from RPC");
      }
      return result.map((item, index) => {
        if (item.status === "invalid") {
          console.warn(`[RPC] Invalid key image at index ${index}: ${item.msg}`);
          return {
            keyImage: keyImageHexArray[index],
            status: "invalid",
            msg: item.msg,
            spent: false
          };
        }
        return {
          keyImage: keyImageHexArray[index],
          status: "valid",
          spent: Boolean(item.spent),
          spentinmempool: Boolean(item.spentinmempool),
          txid: item.txid
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
    static async getRawTransaction(txid, verbose = false) {
      return await this.send("getrawtransaction", [txid, verbose]);
    }
    /**
     * Get block by hash
     *
     * @param blockHash - Block hash
     * @param verbosity - 0=hex, 1=object without tx data, 2=object with tx data
     * @returns Block data
     */
    static async getBlock(blockHash, verbosity = 1) {
      return await this.send("getblock", [blockHash, verbosity]);
    }
    /**
     * Get block hash by height
     *
     * @param height - Block height
     * @returns Block hash
     */
    static async getBlockHash(height) {
      return await this.send("getblockhash", [height]);
    }
    /**
     * List unspent outputs (for wallet)
     *
     * @param minConf - Minimum confirmations (default: 1)
     * @param maxConf - Maximum confirmations (default: 9999999)
     * @param addresses - Filter by addresses (optional)
     * @returns Array of unspent outputs
     */
    static async listUnspent(minConf = 1, maxConf = 9999999, addresses) {
      const params = [minConf, maxConf];
      if (addresses) {
        params.push(addresses);
      }
      return await this.send("listunspent", params);
    }
    /**
     * Test RPC connection
     *
     * @returns True if connection successful
     */
    static async testConnection() {
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
    static async importLightwalletAddress(scanKeyPrivate, spendKeyPublic, fromBlock) {
      return await this.send("importlightwalletaddress", [
        scanKeyPrivate,
        spendKeyPublic,
        fromBlock
      ]);
    }
    /**
     * Get watch-only sync status (Veil-specific)
     *
     * @param scanKeyPrivate - Scan key (private, hex)
     * @param spendKeyPublic - Spend key (public, hex)
     * @returns Status information
     */
    static async getWatchOnlyStatus(scanKeyPrivate, spendKeyPublic) {
      return await this.send("getwatchonlystatus", [
        scanKeyPrivate,
        spendKeyPublic
      ]);
    }
    /**
     * Get transactions for watch-only address (Veil-specific)
     *
     * @param scanKeyPrivate - Scan key (private, hex)
     * @param offset - Number of transactions to skip
     * @returns Watch-only transactions
     */
    static async getWatchOnlyTxes(scanKeyPrivate, offset = 0) {
      return await this.send("getwatchonlytxes", [scanKeyPrivate, offset]);
    }
  };
  /**
   * RPC endpoint URL
   * Default: Veil's Zelcore API
   * Can be configured via:
   * 1. Environment variable: VEIL_NODE_URL
   * 2. Direct assignment: RpcRequester.NODE_URL = 'http://localhost:58810'
   */
  RpcRequester.NODE_URL = typeof process !== "undefined" && process.env?.VEIL_NODE_URL || "https://api.veil.zelcore.io";
  /**
   * RPC authentication password (optional)
   * Only needed for authenticated nodes
   * Can be configured via:
   * 1. Environment variable: VEIL_NODE_PASSWORD
   * 2. Direct assignment: RpcRequester.NODE_PASSWORD = 'your-password'
   */
  RpcRequester.NODE_PASSWORD = typeof process !== "undefined" && process.env?.VEIL_NODE_PASSWORD || null;
  /**
   * RPC username (optional)
   * Default: empty string (common for Veil RPC)
   * Can be configured via:
   * 1. Environment variable: VEIL_NODE_USERNAME
   * 2. Direct assignment: RpcRequester.NODE_USERNAME = 'username'
   */
  RpcRequester.NODE_USERNAME = typeof process !== "undefined" && process.env?.VEIL_NODE_USERNAME || "";
  /**
   * Request timeout in milliseconds
   */
  RpcRequester.TIMEOUT_MS = 3e4;
  /**
   * Current request ID counter
   */
  RpcRequester.requestId = 0;
  async function fetchDecoyOutputs(ringSize, numInputs) {
    return await RpcRequester.getAnonOutputs(numInputs, ringSize);
  }

  // src/TransactionBuilder.ts
  var MIN_RING_SIZE = 3;
  var MAX_RING_SIZE = 32;
  var DEFAULT_RING_SIZE = 11;
  var MAX_ANON_INPUTS = 32;
  var DUST_THRESHOLD = 1e3;
  var DEFAULT_FEE_PER_KB = 1e4;
  var ANON_MARKER2 = 4294967200;
  var CONSOLIDATION_THRESHOLD = 10;
  var TransactionBuilder = class {
    constructor(config = {}) {
      this.wasmInitialized = false;
      this.config = {
        ringSize: config.ringSize ?? DEFAULT_RING_SIZE,
        feePerKb: config.feePerKb ?? DEFAULT_FEE_PER_KB,
        subtractFeeFromOutputs: config.subtractFeeFromOutputs ?? false
      };
      if (!isValidRingSize(this.config.ringSize)) {
        throw new Error(
          `Ring size must be between ${MIN_RING_SIZE} and ${MAX_RING_SIZE}`
        );
      }
    }
    /**
     * Initialize WASM module (must be called before building transactions)
     */
    async initialize() {
      if (this.wasmInitialized) return;
      await initWasm();
      this.wasmInitialized = true;
    }
    /**
     * Build a RingCT transaction
     *
     * Main entry point for transaction building
     */
    async buildTransaction(spendKey, scanKey, recipients, availableUTXOs, dummyOutputs) {
      if (!this.wasmInitialized) {
        await this.initialize();
      }
      this.validateTransactionInputs(recipients, availableUTXOs);
      const totalOutput = recipients.reduce((sum, r) => sum + r.amount, 0n);
      const coinSelection = this.selectCoins(
        availableUTXOs,
        totalOutput,
        this.config.feePerKb
      );
      const changeRecipient = this.buildChangeRecipient(
        spendKey,
        scanKey,
        coinSelection.change
      );
      const builtRecipients = await Promise.all(
        recipients.map((r) => this.buildRecipientOutput(r))
      );
      const builtChangeRecipient = coinSelection.change > 0n ? await this.buildRecipientOutput(changeRecipient) : null;
      const tx = {
        version: 2,
        txType: 0 /* STANDARD */,
        hasWitness: true,
        // RingCT always has witness data
        lockTime: 0,
        inputs: [],
        outputs: [],
        ringSize: this.config.ringSize,
        fee: coinSelection.fee
      };
      await this.addCTData(tx, builtRecipients, builtChangeRecipient);
      await this.addInputs(
        tx,
        coinSelection.utxos,
        dummyOutputs,
        spendKey,
        scanKey
      );
      await this.insertKeyImages(tx, coinSelection.utxos, spendKey, scanKey);
      await this.generateMLSAGSignatures(
        tx,
        coinSelection.utxos,
        dummyOutputs,
        spendKey,
        scanKey
      );
      debug(`
[buildTransaction] Checking inputs before serialization:`);
      for (let i = 0; i < tx.inputs.length; i++) {
        const input = tx.inputs[i];
        debug(`  Input ${i}:`);
        debug(`    scriptData exists: ${!!input.scriptData}`);
        debug(`    scriptData.stack length: ${input.scriptData?.stack?.length || 0}`);
        if (input.scriptData?.stack?.[0]) {
          debug(`    scriptData.stack[0] length: ${input.scriptData.stack[0].length} bytes`);
          debug(`    scriptData.stack[0] hex: ${bytesToHex(input.scriptData.stack[0]).slice(0, 40)}...`);
        }
        debug(`    scriptWitness exists: ${!!input.scriptWitness}`);
        debug(`    scriptWitness.stack length: ${input.scriptWitness?.stack?.length || 0}`);
      }
      debug("");
      const txHex = this.serializeTransaction(tx);
      const txid = await this.calculateTxid(txHex);
      return {
        txHex,
        txid,
        fee: coinSelection.fee,
        change: coinSelection.change,
        size: txHex.length / 2,
        inputs: coinSelection.utxos,
        outputs: tx.outputs
      };
    }
    // ============================================================================
    // High-Level Wallet API
    // ============================================================================
    /**
     * Send VEIL to recipients (Smart Wrapper - Handles Everything Automatically)
     *
     * This is the main method wallet developers should use. It:
     * - Automatically fetches decoys from the network
     * - Checks UTXO health and warns about fragmentation
     * - Handles multi-transaction scenarios automatically
     * - Provides clear guidance on what to do
     *
     * @param spendKey - Spend private key
     * @param scanKey - Scan private key
     * @param recipients - Array of recipients (address, amount)
     * @param availableUTXOs - All available UTXOs
     * @returns Transaction result or multi-transaction plan
     */
    async send(spendKey, scanKey, recipients, availableUTXOs) {
      if (!this.wasmInitialized) {
        await this.initialize();
      }
      const analysis = this.analyzeUTXOs(availableUTXOs);
      const totalAmount = recipients.reduce((sum, r) => sum + r.amount, 0n);
      if (totalAmount > analysis.totalValue) {
        return {
          success: false,
          error: `Insufficient funds: need ${satoshisToVeil(totalAmount)} VEIL, have ${satoshisToVeil(analysis.totalValue)} VEIL`
        };
      }
      let warning;
      if (analysis.needsConsolidation) {
        warning = `\u26A0\uFE0F  You have ${analysis.totalUtxos} UTXOs. Consider consolidating first for better efficiency.`;
      } else if (analysis.isFragmented) {
        warning = `\u{1F4A1} You have ${analysis.totalUtxos} UTXOs. Consider consolidating when fees are low.`;
      }
      const canSend = this.canSendInSingleTransaction(availableUTXOs, totalAmount);
      if (!canSend.canSend) {
        const plan = this.planMultiTransaction(availableUTXOs, totalAmount);
        if (!plan.feasible) {
          return {
            success: false,
            error: plan.error,
            recommendation: "Consider consolidating UTXOs first, then try sending again."
          };
        }
        return {
          success: false,
          multiTxRequired: true,
          plan: {
            transactions: plan.transactions,
            totalFees: plan.totalFees
          },
          warning,
          recommendation: `This send requires ${plan.transactions.length} separate transactions. Total fees: ${satoshisToVeil(plan.totalFees)} VEIL. Consider consolidating UTXOs first to reduce fees and complexity.`
        };
      }
      try {
        debug(`[Send] Fetching decoys for ${canSend.requiredInputs} inputs...`);
        const decoys = await fetchDecoyOutputs(this.config.ringSize, canSend.requiredInputs);
        debug(`[Send] Building transaction...`);
        const result = await this.buildTransaction(
          spendKey,
          scanKey,
          recipients,
          availableUTXOs,
          decoys
        );
        return {
          success: true,
          result,
          warning
        };
      } catch (error) {
        return {
          success: false,
          error: error.message,
          recommendation: "Check your inputs and try again. If the error persists, try consolidating UTXOs first."
        };
      }
    }
    /**
     * Consolidate UTXOs (Smart Wrapper)
     *
     * Automatically consolidates fragmented UTXOs to improve wallet efficiency.
     * Handles everything automatically - just call and it works!
     *
     * @param spendKey - Spend private key
     * @param scanKey - Scan private key
     * @param availableUTXOs - All available UTXOs to consolidate
     * @param maxInputsPerTx - Max inputs per transaction (default: 32)
     * @returns Consolidation results
     */
    async consolidate(spendKey, scanKey, availableUTXOs, maxInputsPerTx = MAX_ANON_INPUTS) {
      if (!this.wasmInitialized) {
        await this.initialize();
      }
      if (availableUTXOs.length === 0) {
        return {
          success: false,
          error: "No UTXOs to consolidate",
          transactions: [],
          totalFees: 0n,
          before: { utxos: 0, value: 0n },
          after: { utxos: 0, value: 0n }
        };
      }
      if (availableUTXOs.length === 1) {
        return {
          success: true,
          transactions: [],
          totalFees: 0n,
          before: { utxos: 1, value: availableUTXOs[0].amount },
          after: { utxos: 1, value: availableUTXOs[0].amount }
        };
      }
      const before = {
        utxos: availableUTXOs.length,
        value: availableUTXOs.reduce((sum, u) => sum + u.amount, 0n)
      };
      debug(`[Consolidate] Starting consolidation of ${before.utxos} UTXOs...`);
      debug(`[Consolidate] Total value: ${satoshisToVeil(before.value)} VEIL`);
      try {
        const transactions = [];
        let totalFees = 0n;
        let remainingUtxos = [...availableUTXOs];
        let round = 1;
        while (remainingUtxos.length > 1) {
          const batchSize = Math.min(maxInputsPerTx, remainingUtxos.length);
          const batch = remainingUtxos.splice(0, batchSize);
          debug(`[Consolidate] Round ${round}: Consolidating ${batch.length} UTXOs...`);
          const decoys = await fetchDecoyOutputs(this.config.ringSize, batch.length);
          const tx = await this.buildConsolidationTransaction(
            spendKey,
            scanKey,
            batch,
            decoys,
            batchSize
          );
          transactions.push(tx);
          totalFees += tx.fee;
          debug(`[Consolidate] Round ${round} complete. Fee: ${satoshisToVeil(tx.fee)} VEIL`);
          round++;
        }
        const after = {
          utxos: remainingUtxos.length + transactions.length,
          value: before.value - totalFees
        };
        debug(`[Consolidate] \u2705 Consolidation complete!`);
        debug(`[Consolidate] Before: ${before.utxos} UTXOs`);
        debug(`[Consolidate] After: ${after.utxos} UTXOs`);
        debug(`[Consolidate] Total fees: ${satoshisToVeil(totalFees)} VEIL`);
        debug(`[Consolidate] Saved: ${before.utxos - after.utxos} UTXOs`);
        return {
          success: true,
          transactions,
          totalFees,
          before,
          after
        };
      } catch (error) {
        return {
          success: false,
          error: error.message,
          transactions: [],
          totalFees: 0n,
          before,
          after: before
        };
      }
    }
    /**
     * Get wallet health status
     *
     * Quick health check for wallet developers to show in UI
     */
    getWalletHealth(utxos) {
      const analysis = this.analyzeUTXOs(utxos);
      let status;
      let message;
      let shouldConsolidate;
      if (analysis.needsConsolidation) {
        status = "critical";
        message = `\u26A0\uFE0F  Critical: ${analysis.totalUtxos} UTXOs detected. You can only spend ${satoshisToVeil(analysis.maxSendableInSingleTx)} VEIL at a time.`;
        shouldConsolidate = true;
      } else if (analysis.isFragmented) {
        status = "fragmented";
        message = `\u{1F4A1} ${analysis.totalUtxos} UTXOs. Consider consolidating for better efficiency.`;
        shouldConsolidate = true;
      } else {
        status = "healthy";
        message = "\u2705 Wallet is healthy";
        shouldConsolidate = false;
      }
      return {
        status,
        utxoCount: analysis.totalUtxos,
        totalValue: analysis.totalValue,
        maxSendable: analysis.maxSendableInSingleTx,
        message,
        shouldConsolidate
      };
    }
    /**
     * Validate transaction inputs
     */
    validateTransactionInputs(recipients, utxos) {
      if (recipients.length === 0) {
        throw new Error("Transaction must have at least one recipient");
      }
      for (const recipient of recipients) {
        if (!isValidAmount(recipient.amount)) {
          throw new Error(`Invalid amount: ${recipient.amount}`);
        }
      }
      if (utxos.length === 0) {
        throw new Error("No UTXOs available for spending");
      }
      for (const utxo of utxos) {
        if (!utxo.amount || !utxo.blind || !utxo.pubkey) {
          throw new Error("UTXO missing required fields (amount, blind, pubkey)");
        }
      }
    }
    /**
     * Select coins to spend
     *
     * Simple coin selection algorithm - can be improved
     */
    selectCoins(utxos, targetAmount, feePerKb) {
      const shuffled = shuffleArray([...utxos]);
      const selected = [];
      let totalValue = 0n;
      const estimateSize = (numInputs, numOutputs) => {
        return 100 + // Base transaction
        numInputs * (this.config.ringSize * 33 + 100) + // Inputs with ring signatures
        numOutputs * (33 + 73 + 50);
      };
      for (const utxo of shuffled) {
        if (selected.length >= MAX_ANON_INPUTS) {
          const txSize2 = estimateSize(selected.length, 2);
          const estimatedFee2 = BigInt(Math.ceil(txSize2 / 1e3 * feePerKb));
          if (totalValue >= targetAmount + estimatedFee2) {
            const change = totalValue - targetAmount - estimatedFee2;
            return {
              utxos: selected,
              totalValue,
              fee: estimatedFee2,
              change
            };
          }
          throw new Error(
            `Transaction would require more than ${MAX_ANON_INPUTS} inputs. Need ${targetAmount}, can only select ${totalValue} with ${MAX_ANON_INPUTS} inputs. Consider consolidating UTXOs or splitting into multiple transactions.`
          );
        }
        selected.push(utxo);
        totalValue += utxo.amount;
        const txSize = estimateSize(selected.length, 2);
        const estimatedFee = BigInt(Math.ceil(txSize / 1e3 * feePerKb));
        if (totalValue >= targetAmount + estimatedFee) {
          const change = totalValue - targetAmount - estimatedFee;
          return {
            utxos: selected,
            totalValue,
            fee: estimatedFee,
            change
          };
        }
      }
      const finalTxSize = estimateSize(selected.length, 2);
      const finalEstimatedFee = BigInt(Math.ceil(finalTxSize / 1e3 * feePerKb));
      const totalNeeded = targetAmount + finalEstimatedFee;
      throw new Error(
        `Insufficient funds: need ${totalNeeded} (${targetAmount} + ${finalEstimatedFee} fee), have ${totalValue}`
      );
    }
    /**
     * Build change recipient (sends back to same address)
     */
    buildChangeRecipient(spendKey, scanKey, changeAmount) {
      const spendPubkey = derivePublicKey2(spendKey);
      const scanPubkey = derivePublicKey2(scanKey);
      const stealthAddress = generateStealthAddress(scanPubkey, spendPubkey);
      return {
        address: stealthAddress,
        amount: changeAmount
      };
    }
    /**
     * Build recipient output with ephemeral key
     */
    async buildRecipientOutput(recipient) {
      const ephemeralData = await generateEphemeralKeys(recipient.address);
      return {
        ...recipient,
        ephemeralPubKey: ephemeralData.ephemeralPubkey,
        ephemeralSecret: ephemeralData.ephemeralSecret,
        sharedSecret: ephemeralData.sharedSecret,
        destPubkey: ephemeralData.destPubkey
      };
    }
    /**
     * Add CT data (commitments and range proofs) to outputs
     */
    async addCTData(tx, recipients, changeRecipient) {
      tx.outputs = [];
      if (tx.fee && tx.fee > 0n) {
        const feeBytes = this.encodeLEB128(tx.fee);
        const vData = new Uint8Array(1 + feeBytes.length);
        vData[0] = 6 /* DO_FEE */;
        vData.set(feeBytes, 1);
        const feeOutput = {
          type: 4 /* OUTPUT_DATA */,
          address: "",
          // No address for fee output
          amount: 0n,
          // Fee is stored in vData, not amount
          vData
        };
        tx.outputs.push(feeOutput);
        const feeBlind = new Uint8Array(32);
        const feeCommitment = createCommitment(tx.fee, feeBlind);
        tx.feeCommitment = feeCommitment;
        tx.feeBlind = feeBlind;
        debug(`[addCTData] Created fee OUTPUT_DATA and commitment for ${tx.fee} satoshis`);
        debug(`  Fee commitment: ${bytesToHex(feeCommitment).slice(0, 20)}...`);
      }
      const allRecipients = changeRecipient ? [...recipients, changeRecipient] : recipients;
      for (const recipient of allRecipients) {
        const blind = this.generateRandomBlind();
        const commitment = createCommitment(recipient.amount, blind);
        const wasm = getWasm();
        const ecdhResult = performEcdh(recipient.destPubkey, recipient.ephemeralSecret);
        const nonce = wasm.hashSha256(ecdhResult);
        const params = selectRangeProofParameters(recipient.amount);
        if (!validateRangeProofParams(params)) {
          throw new Error(`Invalid range proof parameters for value ${recipient.amount}`);
        }
        debug(`[addCTData] Range proof params for ${recipient.amount}: exp=${params.exponent}, bits=${params.minBits}, min=${params.minValue}`);
        const rangeProof = generateRangeProof({
          commitment,
          value: recipient.amount,
          blind,
          nonce,
          message: new Uint8Array(0),
          minValue: params.minValue,
          exp: params.exponent,
          minBits: params.minBits
        });
        const vData = recipient.ephemeralPubKey;
        const output = {
          type: 3 /* OUTPUT_RINGCT */,
          address: recipient.address,
          amount: recipient.amount,
          pk: recipient.destPubkey,
          // Destination public key
          commitment,
          vData,
          vRangeproof: rangeProof.proof,
          blind
        };
        tx.outputs.push(output);
      }
    }
    /**
     * Add inputs (real + decoys) to transaction
     */
    async addInputs(tx, realUTXOs, dummyOutputs, spendKey, scanKey) {
      tx.inputs = [];
      debug(`[addInputs] Ring size: ${this.config.ringSize}`);
      debug(`[addInputs] Number of real UTXOs: ${realUTXOs.length}`);
      const usedDecoyIndices = /* @__PURE__ */ new Set();
      for (let i = 0; i < realUTXOs.length; i++) {
        const realUTXO = realUTXOs[i];
        const secretIndex = Math.floor(Math.random() * this.config.ringSize);
        debug(`[addInputs] Input ${i}: Secret index = ${secretIndex}`);
        const decoys = this.selectDecoys(
          dummyOutputs,
          this.config.ringSize - 1,
          usedDecoyIndices,
          realUTXOs
        );
        for (const decoy of decoys) {
          usedDecoyIndices.add(decoy.index);
        }
        debug(`[addInputs] Input ${i}: Real UTXO pubkey = ${bytesToHex(realUTXO.pubkey).slice(0, 20)}...`);
        const ring = this.buildRingAtPosition(realUTXO, decoys, secretIndex);
        debug(`[addInputs] Input ${i}: Ring[${secretIndex}] = ${bytesToHex(ring[secretIndex]).slice(0, 20)}... (should match real UTXO)`);
        realUTXO.secretIndex = secretIndex;
        const prevoutHash = new Uint8Array(32);
        const nInputs = 1;
        prevoutHash[0] = nInputs & 255;
        prevoutHash[1] = nInputs >> 8 & 255;
        prevoutHash[2] = nInputs >> 16 & 255;
        prevoutHash[3] = nInputs >> 24 & 255;
        prevoutHash[4] = this.config.ringSize & 255;
        prevoutHash[5] = this.config.ringSize >> 8 & 255;
        prevoutHash[6] = this.config.ringSize >> 16 & 255;
        prevoutHash[7] = this.config.ringSize >> 24 & 255;
        const ringIndices = new Array(this.config.ringSize);
        for (let col = 0; col < this.config.ringSize; col++) {
          if (col === secretIndex) {
            if (realUTXO.ringctIndex === void 0) {
              throw new Error(`Real UTXO missing ringctIndex (blockchain output index)`);
            }
            ringIndices[col] = realUTXO.ringctIndex;
            debug(`[addInputs] Real UTXO at ring position ${col}: index=${ringIndices[col]}`);
          } else {
            const decoyIdx = col < secretIndex ? col : col - 1;
            if (decoys[decoyIdx].index === void 0) {
              throw new Error(`Decoy ${decoyIdx} missing index (blockchain output index)`);
            }
            ringIndices[col] = decoys[decoyIdx].index;
            debug(`[addInputs] Decoy ${decoyIdx} at ring position ${col}: index=${ringIndices[col]}, pubkey=${bytesToHex(decoys[decoyIdx].pubkey).slice(0, 16)}...`);
          }
        }
        debug(`[addInputs] Ring indices for input ${i}:`, ringIndices);
        tx.inputs.push({
          ring,
          keyImage: new Uint8Array(33),
          // Will be filled in insertKeyImages
          secretIndex,
          secretKey: spendKey,
          prevout: {
            hash: prevoutHash,
            n: ANON_MARKER2
            // 0xffffffa0 for RingCT inputs
          },
          scriptSig: new Uint8Array(0),
          // Empty for RingCT
          nSequence: 4294967295,
          scriptData: {
            stack: []
            // Will be filled in insertKeyImages
          },
          // Store ring indices for later witness encoding
          ringIndices
        });
      }
    }
    /**
     * Select decoy outputs for ring
     * For multi-input transactions, ensures:
     * - No decoy is reused across inputs
     * - No real UTXO being spent appears as a decoy in any ring
     */
    selectDecoys(dummyOutputs, count, usedDecoyIndices, realUTXOs) {
      const realUTXOPubkeys = /* @__PURE__ */ new Set();
      for (const utxo of realUTXOs) {
        realUTXOPubkeys.add(bytesToHex(utxo.pubkey));
      }
      const availableDecoys = dummyOutputs.filter((decoy) => {
        if (realUTXOPubkeys.has(decoy.pubkey)) {
          return false;
        }
        if (usedDecoyIndices.has(decoy.index)) {
          return false;
        }
        return true;
      });
      if (availableDecoys.length < count) {
        throw new Error(
          `Not enough decoy outputs available. Need ${count}, have ${availableDecoys.length} (after filtering ${realUTXOPubkeys.size} real UTXOs and ${usedDecoyIndices.size} already-used decoys)`
        );
      }
      return randomSample(availableDecoys, count);
    }
    /**
     * Build ring of public keys with real UTXO at specific position
     *
     * Each VIN (input) has its own independent ring with the real UTXO at a
     * randomly selected position. Different VINs will have different positions.
     * This matches Veil Core's implementation.
     *
     * @param realUTXO - The real UTXO to spend
     * @param decoys - Array of decoy outputs
     * @param position - Exact position (0 to ringSize-1) where real UTXO must be placed
     */
    buildRingAtPosition(realUTXO, decoys, position) {
      const ringSize = this.config.ringSize;
      const ring = [];
      let decoyIndex = 0;
      for (let i = 0; i < ringSize; i++) {
        if (i === position) {
          ring.push(realUTXO.pubkey);
        } else {
          ring.push(decoys[decoyIndex].pubkey);
          decoyIndex++;
        }
      }
      return ring;
    }
    /**
     * Insert key images for spent outputs
     * CRITICAL: For stealth addresses, key images must be computed from destination keys,
     * not from the raw spend key!
     */
    async insertKeyImages(tx, utxos, spendKey, scanKey) {
      for (let i = 0; i < tx.inputs.length; i++) {
        const utxo = utxos[i];
        if (!utxo.ephemeralPubkey) {
          throw new Error(`UTXO ${i} missing ephemeralPubkey for key image generation`);
        }
        const destinationKey = this.deriveDestinationKey(
          spendKey,
          scanKey,
          utxo.ephemeralPubkey
        );
        const keyImage = generateKeyImage(utxo.pubkey, destinationKey);
        tx.inputs[i].keyImage = keyImage;
        if (!tx.inputs[i].scriptData) {
          tx.inputs[i].scriptData = { stack: [] };
        }
        tx.inputs[i].scriptData.stack.push(keyImage);
      }
    }
    /**
     * Derive destination secret key for a stealth address UTXO
     *
     * Formula: destination_sk = spend_sk + H(ECDH(scan_sk, ephemeral_pk))
     *
     * This matches the Dart implementation:
     * LightwalletTransactionBuilder.getDestinationKeyForOutput
     */
    deriveDestinationKey(spendKey, scanKey, ephemeralPubkey) {
      const sharedPoint = pointMultiply(ephemeralPubkey, scanKey);
      const wasm = getWasm();
      const sShared = wasm.hashSha256(sharedPoint);
      const destinationKey = privateAdd(spendKey, sShared);
      return destinationKey;
    }
    /**
     * Generate MLSAG signature for a SINGLE input (VIN)
     * This handles the simple case where txNew.vin.length == 1
     */
    async generateSingleInputMLSAG(tx, inputIndex, utxo, dummyOutputs, spendKey, scanKey) {
      const input = tx.inputs[inputIndex];
      const ringSize = input.ring.length;
      const nSigInputs = 1;
      const nRows = nSigInputs + 1;
      debug(`
[generateSingleInputMLSAG] Input ${inputIndex}:`);
      debug(`  Ring size: ${ringSize}`);
      debug(`  nRows: ${nRows} (${nSigInputs} inputs + 1 commitment)`);
      debug(`  Secret index: ${input.secretIndex}`);
      debug(`  Real UTXO pubkey: ${bytesToHex(utxo.pubkey).slice(0, 20)}...`);
      debug(`  Ring contents:`);
      for (let i = 0; i < input.ring.length; i++) {
        const isReal = bytesToHex(input.ring[i]) === bytesToHex(utxo.pubkey);
        debug(`    [${i}]: ${bytesToHex(input.ring[i]).slice(0, 20)}... ${isReal ? "<-- REAL UTXO" : ""}`);
      }
      const vm = new Uint8Array(ringSize * nRows * 33);
      debug(`
  === MATRIX M ROW 0: PUBLIC KEYS ===`);
      const inputRingIndices = input.ringIndices;
      for (let col = 0; col < ringSize; col++) {
        const pk = input.ring[col];
        const row = 0;
        const offset = (col + row * ringSize) * 33;
        vm.set(pk, offset);
        debug(`    M[col=${col}][row=0] = ${bytesToHex(pk).slice(0, 40)}... (index: ${inputRingIndices ? inputRingIndices[col] : "unknown"})`);
      }
      debug(`  ====================================
`);
      const vpInCommits = new Array(ringSize);
      for (let col = 0; col < ringSize; col++) {
        const pubkey = input.ring[col];
        const pubkeyHex = bytesToHex(pubkey);
        if (bytesToHex(utxo.pubkey) === pubkeyHex) {
          vpInCommits[col] = utxo.commitment;
          debug(`  Ring[${col}] = REAL UTXO (commitment: ${bytesToHex(utxo.commitment).slice(0, 20)}..., prefix: 0x${utxo.commitment[0].toString(16).padStart(2, "0")})`);
          continue;
        }
        const decoy = dummyOutputs.find((d) => bytesToHex(d.pubkey) === pubkeyHex);
        if (decoy && decoy.commitment) {
          vpInCommits[col] = decoy.commitment;
          debug(`  Ring[${col}] = DECOY (commitment prefix: 0x${decoy.commitment[0].toString(16).padStart(2, "0")})`);
        } else {
          throw new Error(`Missing commitment for ring member at position ${col}`);
        }
      }
      const vpOutCommits = [];
      if (tx.feeCommitment) {
        vpOutCommits.push(tx.feeCommitment);
        debug(`  Including fee commitment in vpOutCommits (prefix: 0x${tx.feeCommitment[0].toString(16).padStart(2, "0")})`);
      }
      for (const output of tx.outputs) {
        if ("commitment" in output && output.commitment) {
          vpOutCommits.push(output.commitment);
          debug(`  Including RingCT output commitment in vpOutCommits (prefix: 0x${output.commitment[0].toString(16).padStart(2, "0")})`);
        }
      }
      const vpBlinds = [utxo.blind];
      if (tx.feeBlind) {
        vpBlinds.push(tx.feeBlind);
        debug(`  Including fee blind (zeros) in vpBlinds`);
      }
      for (const output of tx.outputs) {
        if (output.blind) {
          vpBlinds.push(output.blind);
        }
      }
      debug(`  Input commitment count: ${vpInCommits.length}`);
      debug(`  Output commitment count: ${vpOutCommits.length}`);
      debug(`  Blind count: ${vpBlinds.length} (1 input + ${vpBlinds.length - 1} outputs)`);
      debug(`  vpInCommits:`);
      for (let i = 0; i < vpInCommits.length; i++) {
        const isZero = vpInCommits[i].every((b) => b === 0);
        debug(`    [${i}]: ${isZero ? "ZERO!" : bytesToHex(vpInCommits[i])}`);
      }
      debug(`  vpOutCommits:`);
      for (let i = 0; i < vpOutCommits.length; i++) {
        debug(`    [${i}]: ${bytesToHex(vpOutCommits[i])}`);
      }
      debug(`  M matrix before prepareMlsag:`);
      for (let col = 0; col < ringSize; col++) {
        for (let row = 0; row < nRows; row++) {
          const offset = (col + row * ringSize) * 33;
          const point = vm.slice(offset, offset + 33);
          const isZero = point.every((b) => b === 0);
          debug(`    [col${col}][row${row}] @ offset ${offset}: ${isZero ? "ZERO!" : bytesToHex(point).slice(0, 20) + "..."}`);
        }
      }
      debug(`
=== PREPARE_MLSAG CALL (Real Transaction) ===`);
      debug(`m_initial: ${bytesToHex(vm)}`);
      debug(`nOuts: ${vpOutCommits.length}`);
      debug(`nBlinded: ${vpOutCommits.length}`);
      debug(`vpInCommitsLen: ${vpInCommits.length}`);
      debug(`vpBlindsLen: ${vpBlinds.length}`);
      debug(`nCols: ${ringSize}`);
      debug(`nRows: ${nRows}`);
      debugGroup(`vpInCommits (${vpInCommits.length} items)`, () => {
        vpInCommits.forEach((c, i) => debug(`  [${i}]: ${bytesToHex(c)}`));
      });
      debugGroup(`vpOutCommits (${vpOutCommits.length} items)`, () => {
        vpOutCommits.forEach((c, i) => debug(`  [${i}]: ${bytesToHex(c)}`));
      });
      debugGroup(`vpBlinds (${vpBlinds.length} items)`, () => {
        vpBlinds.forEach((b, i) => debug(`  [${i}]: ${bytesToHex(b)}`));
      });
      debug(`==============================================
`);
      const prepared = prepareMlsag({
        m: vm,
        nOuts: vpOutCommits.length,
        // All commits (fee + RingCT)
        nBlinded: vpOutCommits.length,
        // Same (fee commit explicitly included)
        vpInCommitsLen: vpInCommits.length,
        vpBlindsLen: vpBlinds.length,
        nCols: ringSize,
        nRows,
        vpInCommits,
        vpOutCommits,
        // [fee_commit, ringct1, ringct2]
        vpBlinds
        // [input_blind, output1_blind, output2_blind] - NO fee blind
      });
      debug(`
=== PREPARE_MLSAG RESULT (Real Transaction) ===`);
      debug(`m_updated: ${bytesToHex(prepared.m)}`);
      debug(`sk: ${bytesToHex(prepared.sk)}`);
      debug(`===============================================
`);
      debug(`  Blind sum: ${bytesToHex(prepared.sk).slice(0, 20)}...`);
      debug(`  M matrix AFTER prepareMlsag:`);
      for (let col = 0; col < ringSize; col++) {
        for (let row = 0; row < nRows; row++) {
          const offset = (col + row * ringSize) * 33;
          const point = prepared.m.slice(offset, offset + 33);
          const isZero = point.every((b) => b === 0);
          debug(`    [col${col}][row${row}] @ offset ${offset}: ${isZero ? "ZERO!" : bytesToHex(point).slice(0, 20) + "..."}`);
        }
      }
      const destinationKey = this.deriveDestinationKey(
        spendKey,
        scanKey,
        utxo.ephemeralPubkey
      );
      const derivedPubkey = derivePublicKey2(destinationKey);
      if (bytesToHex(derivedPubkey) !== bytesToHex(utxo.pubkey)) {
        throw new Error(`Destination key mismatch for input ${inputIndex}`);
      }
      const vpsk = [
        destinationKey,
        // Input secret key
        prepared.sk
        // Blind sum
      ];
      const txHash = this.calculateTransactionHash(tx);
      debug(`  Transaction hash: ${bytesToHex(txHash).slice(0, 20)}...`);
      const nonce = getRandomBytes(32);
      const secretIndex = input.secretIndex;
      debug(`  Secret index: ${secretIndex}`);
      debug(`  Generating MLSAG...`);
      debug(`  Number of outputs in tx: ${tx.outputs.length}`);
      debug(`  Output types: ${tx.outputs.map((o) => o.type).join(", ")}`);
      debug(`
=== GENERATE_MLSAG CALL (Real Transaction) ===`);
      debug(`nonce: ${bytesToHex(nonce)}`);
      debug(`preimage: ${bytesToHex(txHash)}`);
      debug(`nCols: ${ringSize}`);
      debug(`nRows: ${nRows}`);
      debug(`index: ${secretIndex}`);
      debugGroup(`secretKeys (${vpsk.length} items)`, () => {
        vpsk.forEach((sk, i) => debug(`  sk[${i}]: ${bytesToHex(sk)}`));
      });
      debug(`publicKeys: ${bytesToHex(prepared.m)}`);
      debug(`==============================================
`);
      const mlsagResult = generateMlsag({
        nonce,
        preimage: txHash,
        nCols: ringSize,
        nRows,
        index: secretIndex,
        secretKeys: vpsk,
        publicKeys: prepared.m
      });
      debug(`
=== GENERATE_MLSAG RESULT (Real Transaction) ===`);
      debug(`key_images: ${bytesToHex(mlsagResult.keyImages)}`);
      debug(`pc: ${bytesToHex(mlsagResult.pc)}`);
      debug(`ps: ${bytesToHex(mlsagResult.ps)}`);
      debug(`================================================
`);
      debug(`  \u2705 MLSAG generated`);
      debug(`    Key images: ${bytesToHex(mlsagResult.keyImages).slice(0, 40)}...`);
      debug(`    pc length: ${mlsagResult.pc.length} bytes`);
      debug(`    ps length: ${mlsagResult.ps.length} bytes`);
      debug(`  Verifying MLSAG...`);
      debug(`    preimage: ${bytesToHex(txHash).slice(0, 40)}... (${txHash.length} bytes)`);
      debug(`    publicKeys: ${prepared.m.length} bytes (expected: ${ringSize * nRows * 33})`);
      debug(`    keyImages: ${mlsagResult.keyImages.length} bytes (expected: ${(nRows - 1) * 33})`);
      debug(`    pc: ${mlsagResult.pc.length} bytes (expected: 32)`);
      debug(`    ps: ${mlsagResult.ps.length} bytes (expected: ${ringSize * nRows * 32})`);
      debug(`    nCols: ${ringSize}, nRows: ${nRows}`);
      const isValid = verifyMlsag({
        preimage: txHash,
        nCols: ringSize,
        nRows,
        publicKeys: prepared.m,
        keyImages: mlsagResult.keyImages,
        pc: mlsagResult.pc,
        ps: mlsagResult.ps
      });
      if (!isValid) {
        throw new Error(`MLSAG verification failed for input ${inputIndex}`);
      }
      debug(`  \u2705 MLSAG verified`);
      const ringIndices = input.ringIndices;
      if (!ringIndices) {
        throw new Error("Ring indices not found on input");
      }
      debug(`  Encoding ${ringIndices.length} ring member indices as varints...`);
      const encodedIndices = this.encodeRingIndices(ringIndices);
      debug(`  Encoded indices: ${encodedIndices.length} bytes`);
      const vDL = new Uint8Array(mlsagResult.pc.length + mlsagResult.ps.length);
      vDL.set(mlsagResult.pc, 0);
      vDL.set(mlsagResult.ps, mlsagResult.pc.length);
      debug(`  Combined MLSAG signature (vDL): ${vDL.length} bytes`);
      input.scriptWitness = {
        stack: [encodedIndices, vDL]
      };
    }
    /**
     * Encode ring member indices using LEB128
     * Used for scriptWitness.stack[0]
     *
     * Matches Veil C++: lightwallet.cpp:1536
     *   PutVarInt(vPubkeyMatrixIndices, vMI[l][k][i]);
     */
    encodeRingIndices(indices) {
      debug(`
  === ENCODING RING INDICES FOR TRANSACTION ===`);
      const parts = [];
      for (let i = 0; i < indices.length; i++) {
        const index = indices[i];
        const encoded = this.encodeLEB128(BigInt(index));
        parts.push(encoded);
        debug(`    Ring[${i}]: index=${index} -> LEB128: ${bytesToHex(encoded)}`);
      }
      const result = concatBytes(...parts);
      debug(`  Total encoded size: ${result.length} bytes`);
      debug(`  Full encoded data: ${bytesToHex(result)}`);
      debug(`  ============================================
`);
      return result;
    }
    /**
     * Generate MLSAG signatures for transaction
     * Creates ONE MLSAG PER INPUT (VIN), not one for all inputs!
     */
    async generateMLSAGSignatures(tx, utxos, dummyOutputs, spendKey, scanKey) {
      const numInputs = tx.inputs.length;
      debug(`
[generateMLSAGSignatures] Generating ${numInputs} MLSAG signature(s)...`);
      if (numInputs === 1) {
        debug(`[generateMLSAGSignatures] Single input - using all output commitments`);
        await this.generateSingleInputMLSAG(tx, 0, utxos[0], dummyOutputs, spendKey, scanKey);
      } else {
        debug(`[generateMLSAGSignatures] Multi-input - splitting output commitments`);
        await this.generateMultiInputMLSAG(tx, utxos, dummyOutputs, spendKey, scanKey);
      }
      tx.witness = {
        scriptWitness: tx.inputs.map((input) => {
          if (!input.scriptWitness) {
            throw new Error("Input missing scriptWitness after MLSAG generation");
          }
          return input.scriptWitness;
        })
      };
      debug(`[generateMLSAGSignatures] \u2705 All MLSAG signatures generated and verified
`);
    }
    /**
     * Generate MLSAG signatures for multi-input transaction with split commitments
     *
     * In multi-input RingCT, each input creates its own "split commitment" representing
     * the value contributed by that input. The Pedersen commitment balance is:
     *   sum(split_commits) = sum(output_commits) + fee_commit
     *
     * Each input's MLSAG only sees its own split commitment (nOuts=1, nBlinded=1).
     * The last input's blind is calculated to balance the equation.
     *
     * This matches Veil C++ implementation in anonwallet.cpp
     */
    async generateMultiInputMLSAG(tx, utxos, dummyOutputs, spendKey, scanKey) {
      const numInputs = tx.inputs.length;
      debug(`
[generateMultiInputMLSAG] Processing ${numInputs} inputs`);
      debug(`  Creating split commitments (one per input)`);
      const outputBlinds = [];
      if (tx.feeBlind) {
        outputBlinds.push(tx.feeBlind);
      }
      for (const output of tx.outputs) {
        if (output.blind) {
          outputBlinds.push(output.blind);
        }
      }
      debug(`  Total output blinds for balancing: ${outputBlinds.length}`);
      const splitCommitBlinds = [];
      for (let i = 0; i < numInputs; i++) {
        if (i === numInputs - 1) {
          const allBlindsForSum = [...outputBlinds, ...splitCommitBlinds];
          const balancingBlind = sumBlinds(allBlindsForSum, outputBlinds.length);
          splitCommitBlinds.push(balancingBlind);
          debug(`  Input ${i}: Calculated balancing blind`);
        } else {
          const randomBlind = this.generateRandomBlind();
          splitCommitBlinds.push(randomBlind);
          debug(`  Input ${i}: Generated random blind`);
        }
      }
      for (let i = 0; i < numInputs; i++) {
        const inputValue = utxos[i].amount;
        debug(`
  Input ${i}:`);
        debug(`    Value: ${satoshisToVeil(inputValue)} VEIL`);
        await this.generateMultiInputMLSAGForInput(
          tx,
          i,
          utxos[i],
          dummyOutputs,
          spendKey,
          scanKey,
          inputValue,
          splitCommitBlinds[i]
        );
      }
      debug(`
[generateMultiInputMLSAG] \u2705 All ${numInputs} MLSAG signatures generated`);
    }
    /**
     * Generate MLSAG for a single input in a multi-input transaction
     * Uses a split commitment (commitment to this input's value only)
     */
    async generateMultiInputMLSAGForInput(tx, inputIndex, utxo, dummyOutputs, spendKey, scanKey, inputValue, splitCommitBlind) {
      const input = tx.inputs[inputIndex];
      const ringSize = input.ring.length;
      const nSigInputs = 1;
      const nRows = nSigInputs + 1;
      debug(`    [Input ${inputIndex}] Generating MLSAG with split commitment:`);
      debug(`      Ring size: ${ringSize}`);
      debug(`      nRows: ${nRows}`);
      debug(`      Secret index: ${input.secretIndex}`);
      const splitCommitment = createCommitment(inputValue, splitCommitBlind);
      debug(`      Split commitment: ${bytesToHex(splitCommitment).slice(0, 20)}...`);
      const vm = new Uint8Array(ringSize * nRows * 33);
      for (let col = 0; col < ringSize; col++) {
        const pk = input.ring[col];
        const row = 0;
        const offset = (col + row * ringSize) * 33;
        vm.set(pk, offset);
      }
      const vpInCommits = new Array(ringSize);
      for (let col = 0; col < ringSize; col++) {
        const pubkey = input.ring[col];
        const pubkeyHex = bytesToHex(pubkey);
        if (bytesToHex(utxo.pubkey) === pubkeyHex) {
          vpInCommits[col] = utxo.commitment;
          continue;
        }
        const decoy = dummyOutputs.find((d) => bytesToHex(d.pubkey) === pubkeyHex);
        if (decoy && decoy.commitment) {
          vpInCommits[col] = decoy.commitment;
        } else {
          throw new Error(`Missing commitment for ring member at position ${col}`);
        }
      }
      const vpOutCommits = [splitCommitment];
      const vpBlinds = [utxo.blind, splitCommitBlind];
      debug(`      Input commitment count: ${vpInCommits.length}`);
      debug(`      Output commitment count: ${vpOutCommits.length} (split commit only)`);
      debug(`      Blind count: ${vpBlinds.length}`);
      const prepared = prepareMlsag({
        m: vm,
        nOuts: 1,
        // Only the split commitment
        nBlinded: 1,
        // Only the split commitment
        vpInCommitsLen: vpInCommits.length,
        vpBlindsLen: vpBlinds.length,
        nCols: ringSize,
        nRows,
        vpInCommits,
        vpOutCommits,
        vpBlinds
      });
      const destinationKey = this.deriveDestinationKey(
        spendKey,
        scanKey,
        utxo.ephemeralPubkey
      );
      const vpsk = [
        destinationKey,
        prepared.sk
      ];
      const txHash = this.calculateTransactionHash(tx);
      const nonce = getRandomBytes(32);
      const secretIndex = input.secretIndex;
      debug(`      Generating MLSAG with secret index ${secretIndex}...`);
      const mlsagResult = generateMlsag({
        nonce,
        preimage: txHash,
        nCols: ringSize,
        nRows,
        index: secretIndex,
        secretKeys: vpsk,
        publicKeys: prepared.m
      });
      const isValid = verifyMlsag({
        preimage: txHash,
        nCols: ringSize,
        nRows,
        publicKeys: prepared.m,
        keyImages: mlsagResult.keyImages,
        pc: mlsagResult.pc,
        ps: mlsagResult.ps
      });
      if (!isValid) {
        throw new Error(`MLSAG verification failed for input ${inputIndex}`);
      }
      debug(`      \u2705 MLSAG verified for input ${inputIndex}`);
      debug(`      Key images from MLSAG: ${bytesToHex(mlsagResult.keyImages).slice(0, 40)}...`);
      debug(`      Key images already in scriptData from insertKeyImages()`);
      const ringIndices = input.ringIndices;
      if (!ringIndices) {
        throw new Error("Ring indices not found on input");
      }
      const encodedIndices = this.encodeRingIndices(ringIndices);
      const vDL = new Uint8Array(mlsagResult.pc.length + mlsagResult.ps.length + 33);
      vDL.set(mlsagResult.pc, 0);
      vDL.set(mlsagResult.ps, mlsagResult.pc.length);
      vDL.set(splitCommitment, mlsagResult.pc.length + mlsagResult.ps.length);
      debug(`      Witness size: ${vDL.length} bytes (includes 33-byte split commitment)`);
      input.scriptWitness = {
        stack: [encodedIndices, vDL]
      };
    }
    /**
     * Encode a BigInt as a variable-length integer (varint)
     * Bitcoin-style varint encoding (for lengths/counts)
     *
     * NOT used for ring indices or fees - those use LEB128!
     */
    encodeVarInt(value) {
      if (value < 0n) {
        throw new Error("Cannot encode negative value as varint");
      }
      if (value < 0xfdn) {
        return new Uint8Array([Number(value)]);
      } else if (value < 0x10000n) {
        const buf = new Uint8Array(3);
        buf[0] = 253;
        buf[1] = Number(value & 0xffn);
        buf[2] = Number(value >> 8n & 0xffn);
        return buf;
      } else if (value < 0x100000000n) {
        const buf = new Uint8Array(5);
        buf[0] = 254;
        buf[1] = Number(value & 0xffn);
        buf[2] = Number(value >> 8n & 0xffn);
        buf[3] = Number(value >> 16n & 0xffn);
        buf[4] = Number(value >> 24n & 0xffn);
        return buf;
      } else {
        const buf = new Uint8Array(9);
        buf[0] = 255;
        for (let i = 0; i < 8; i++) {
          buf[i + 1] = Number(value >> BigInt(i * 8) & 0xffn);
        }
        return buf;
      }
    }
    /**
     * Encode a BigInt using LEB128 (Little Endian Base 128)
     *
     * This matches Veil's PutVarInt in serialize.h:453
     * Used for: ring member indices, fee values
     *
     * Encoding: 7-bit chunks with continuation bit (0x80)
     * Example: 253687 → [0xb7, 0xdf, 0x03]
     */
    encodeLEB128(value) {
      if (value < 0n) {
        throw new Error("Cannot encode negative value as LEB128");
      }
      const bytes = [];
      let remaining = value;
      while (remaining > 0x7Fn) {
        bytes.push(Number(remaining & 0x7Fn) | 128);
        remaining >>= 7n;
      }
      bytes.push(Number(remaining & 0x7Fn));
      return new Uint8Array(bytes);
    }
    /**
     * Calculate transaction hash for signing
     *
     * This hashes all outputs to create the preimage for MLSAG
     *
     * Matches Dart implementation: CMutableTransaction.getOutputsHash()
     * Uses iterative double-SHA256 hashing
     */
    calculateTransactionHash(tx) {
      const wasm = getWasm();
      debug(`
=== CALCULATING TRANSACTION HASH (PREIMAGE) ===`);
      debug(`Number of outputs: ${tx.outputs.length}`);
      const pblank = new Uint8Array(32).fill(0);
      let hashOutputs = new Uint8Array(32).fill(0);
      let hashOutputsSet = false;
      for (let i = 0; i < tx.outputs.length; i++) {
        const output = tx.outputs[i];
        debug(`
Output ${i}: type=${output.type}`);
        const serialized = serializeOutputData(output);
        debug(`  Serialized size: ${serialized.length} bytes`);
        debug(`  Serialized (first 64 bytes): ${bytesToHex(serialized.slice(0, 64))}`);
        let hash = wasm.hashSha256(serialized);
        hash = wasm.hashSha256(hash);
        debug(`  Double-SHA256: ${bytesToHex(hash)}`);
        const hsh1 = hash;
        const hsh2 = hashOutputsSet ? hashOutputs : pblank;
        debug(`  Previous hash: ${bytesToHex(hsh2).slice(0, 40)}...`);
        const combined = new Uint8Array(hsh1.length + hsh2.length);
        combined.set(hsh1, 0);
        combined.set(hsh2, hsh1.length);
        const temp = wasm.hashSha256(combined);
        const newHash = wasm.hashSha256(temp);
        hashOutputs = new Uint8Array(newHash);
        hashOutputsSet = true;
        debug(`  Running hash: ${bytesToHex(hashOutputs)}`);
      }
      debug(`
=== FINAL TRANSACTION HASH (PREIMAGE) ===`);
      debug(`  ${bytesToHex(hashOutputs)}`);
      debug(`===========================================
`);
      return hashOutputs;
    }
    /**
     * Generate random blinding factor
     */
    generateRandomBlind() {
      const blind = new Uint8Array(32);
      crypto.getRandomValues(blind);
      return blind;
    }
    /**
     * Serialize transaction to hex
     *
     * Uses the serialization module to convert the transaction to Veil's binary format
     */
    serializeTransaction(tx) {
      return serializeTransaction(tx);
    }
    /**
     * Calculate transaction ID
     */
    async calculateTxid(txHex) {
      const txBytes = hexToBytes(txHex);
      const hash = await doubleSha256(txBytes);
      return bytesToHex(hash.reverse());
    }
    /**
     * Estimate transaction fee
     */
    estimateFee(numInputs, numOutputs) {
      const size = 100 + // Base
      numInputs * (this.config.ringSize * 33 + 100) + // Inputs
      numOutputs * 156;
      const sizeKb = size / 1e3;
      return BigInt(Math.ceil(sizeKb * this.config.feePerKb));
    }
    // ============================================================================
    // UTXO Management & Analysis
    // ============================================================================
    /**
     * Analyze UTXO set for fragmentation and provide recommendations
     */
    analyzeUTXOs(utxos) {
      if (utxos.length === 0) {
        return {
          totalUtxos: 0,
          totalValue: 0n,
          averageValue: 0n,
          largestUtxo: 0n,
          smallestUtxo: 0n,
          isFragmented: false,
          needsConsolidation: false,
          maxSendableInSingleTx: 0n,
          recommendation: "No UTXOs available"
        };
      }
      const totalValue = utxos.reduce((sum, utxo) => sum + utxo.amount, 0n);
      const averageValue = totalValue / BigInt(utxos.length);
      const sorted = [...utxos].sort((a, b) => a.amount > b.amount ? -1 : 1);
      const largestUtxo = sorted[0].amount;
      const smallestUtxo = sorted[sorted.length - 1].amount;
      const top32 = sorted.slice(0, Math.min(MAX_ANON_INPUTS, utxos.length));
      const maxWith32Inputs = top32.reduce((sum, utxo) => sum + utxo.amount, 0n);
      const estimatedFee = this.estimateFee(Math.min(MAX_ANON_INPUTS, utxos.length), 2);
      const maxSendableInSingleTx = maxWith32Inputs > estimatedFee ? maxWith32Inputs - estimatedFee : 0n;
      const isFragmented = utxos.length > CONSOLIDATION_THRESHOLD;
      const needsConsolidation = utxos.length > MAX_ANON_INPUTS;
      let recommendation = "";
      if (needsConsolidation) {
        recommendation = `\u26A0\uFE0F  You have ${utxos.length} UTXOs, but can only use ${MAX_ANON_INPUTS} per transaction. Strongly recommend consolidating to avoid issues sending large amounts.`;
      } else if (isFragmented) {
        recommendation = `\u{1F4A1} You have ${utxos.length} UTXOs. Consider consolidating when fees are low to improve transaction efficiency.`;
      } else {
        recommendation = "\u2705 UTXO set is healthy.";
      }
      return {
        totalUtxos: utxos.length,
        totalValue,
        averageValue,
        largestUtxo,
        smallestUtxo,
        isFragmented,
        needsConsolidation,
        maxSendableInSingleTx,
        recommendation
      };
    }
    /**
     * Check if an amount can be sent in a single transaction
     */
    canSendInSingleTransaction(utxos, amount) {
      const sorted = [...utxos].sort((a, b) => a.amount > b.amount ? -1 : 1);
      let totalValue = 0n;
      let inputCount = 0;
      for (const utxo of sorted) {
        if (inputCount >= MAX_ANON_INPUTS) {
          break;
        }
        totalValue += utxo.amount;
        inputCount++;
        const estimatedFee = this.estimateFee(inputCount, 2);
        if (totalValue >= amount + estimatedFee) {
          return {
            canSend: true,
            requiredInputs: inputCount
          };
        }
      }
      return {
        canSend: false,
        requiredInputs: inputCount,
        reason: `Cannot send ${amount} in single transaction. Max with ${MAX_ANON_INPUTS} inputs: ${totalValue}`
      };
    }
    /**
     * Plan how to split a large send into multiple transactions
     */
    planMultiTransaction(utxos, totalAmount) {
      const analysis = this.analyzeUTXOs(utxos);
      if (totalAmount > analysis.totalValue) {
        return {
          transactions: [],
          totalFees: 0n,
          feasible: false,
          error: `Insufficient funds: need ${totalAmount}, have ${analysis.totalValue}`
        };
      }
      const sorted = [...utxos].sort((a, b) => a.amount > b.amount ? -1 : 1);
      const transactions = [];
      let remainingAmount = totalAmount;
      let availableUtxos = [...sorted];
      let totalFees = 0n;
      while (remainingAmount > 0n && availableUtxos.length > 0) {
        const batchUtxos = availableUtxos.splice(0, Math.min(MAX_ANON_INPUTS, availableUtxos.length));
        const batchValue = batchUtxos.reduce((sum, utxo) => sum + utxo.amount, 0n);
        const estimatedFee = this.estimateFee(batchUtxos.length, 2);
        if (batchValue <= estimatedFee) {
          return {
            transactions: [],
            totalFees: 0n,
            feasible: false,
            error: "UTXOs too small to cover fees"
          };
        }
        const sendable = batchValue - estimatedFee;
        const sendAmount = remainingAmount > sendable ? sendable : remainingAmount;
        transactions.push({
          inputUtxos: batchUtxos,
          amount: sendAmount,
          estimatedFee
        });
        totalFees += estimatedFee;
        remainingAmount -= sendAmount;
      }
      if (remainingAmount > 0n) {
        return {
          transactions: [],
          totalFees: 0n,
          feasible: false,
          error: `Cannot send full amount even with multiple transactions. Short by: ${remainingAmount}`
        };
      }
      return {
        transactions,
        totalFees,
        feasible: true
      };
    }
    /**
     * Build a UTXO consolidation transaction
     *
     * Consolidates up to MAX_ANON_INPUTS UTXOs into a single output sent back to the same address
     */
    async buildConsolidationTransaction(spendKey, scanKey, utxos, decoyOutputs, maxInputs = MAX_ANON_INPUTS) {
      if (utxos.length === 0) {
        throw new Error("No UTXOs to consolidate");
      }
      if (maxInputs < 1 || maxInputs > MAX_ANON_INPUTS) {
        throw new Error(`maxInputs must be between 1 and ${MAX_ANON_INPUTS}`);
      }
      const sorted = [...utxos].sort((a, b) => a.amount > b.amount ? -1 : 1);
      const selectedUtxos = sorted.slice(0, Math.min(maxInputs, utxos.length));
      const totalInput = selectedUtxos.reduce((sum, utxo) => sum + utxo.amount, 0n);
      const estimatedFee = this.estimateFee(selectedUtxos.length, 1);
      if (totalInput <= estimatedFee) {
        throw new Error("UTXOs too small to cover consolidation fee");
      }
      const outputAmount = totalInput - estimatedFee;
      const spendPubkey = derivePublicKey2(spendKey);
      const scanPubkey = derivePublicKey2(scanKey);
      const stealthAddress = generateStealthAddress(scanPubkey, spendPubkey);
      const recipient = {
        address: stealthAddress,
        amount: outputAmount
      };
      debug(`[Consolidation] Consolidating ${selectedUtxos.length} UTXOs`);
      debug(`[Consolidation] Total input: ${satoshisToVeil(totalInput)} VEIL`);
      debug(`[Consolidation] Estimated fee: ${satoshisToVeil(estimatedFee)} VEIL`);
      debug(`[Consolidation] Output amount: ${satoshisToVeil(outputAmount)} VEIL`);
      return await this.buildTransaction(
        spendKey,
        scanKey,
        [recipient],
        selectedUtxos,
        decoyOutputs
      );
    }
    /**
     * Build multiple consolidation transactions to consolidate all UTXOs
     *
     * Returns an array of transactions that will consolidate the UTXO set
     */
    async buildFullConsolidation(spendKey, scanKey, utxos) {
      if (utxos.length === 0) {
        throw new Error("No UTXOs to consolidate");
      }
      const transactions = [];
      let totalFees = 0n;
      let remainingUtxos = [...utxos];
      debug(`[Full Consolidation] Starting with ${utxos.length} UTXOs`);
      let round = 1;
      while (remainingUtxos.length > 1) {
        debug(`[Full Consolidation] Round ${round}: ${remainingUtxos.length} UTXOs remaining`);
        const batchSize = Math.min(MAX_ANON_INPUTS, remainingUtxos.length);
        const batch = remainingUtxos.splice(0, batchSize);
        const decoys = await fetchDecoyOutputs(this.config.ringSize, batch.length);
        const tx = await this.buildConsolidationTransaction(
          spendKey,
          scanKey,
          batch,
          decoys,
          batchSize
        );
        transactions.push(tx);
        totalFees += tx.fee;
        debug(`[Full Consolidation] Round ${round} complete. Fee: ${satoshisToVeil(tx.fee)} VEIL`);
        round++;
      }
      const finalUtxoCount = remainingUtxos.length + transactions.length;
      debug(`[Full Consolidation] Complete!`);
      debug(`  - Original UTXOs: ${utxos.length}`);
      debug(`  - Final UTXOs: ${finalUtxoCount}`);
      debug(`  - Total fees: ${satoshisToVeil(totalFees)} VEIL`);
      debug(`  - Transactions needed: ${transactions.length}`);
      return {
        transactions,
        totalFees,
        originalUtxoCount: utxos.length,
        finalUtxoCount
      };
    }
    // ============================================================================
    // CT -> RingCT Transaction Building (sendstealthtoringct)
    // ============================================================================
    /**
     * Send from CT (stealth) outputs to RingCT outputs
     *
     * This is the equivalent of the Veil Core `sendstealthtoringct` RPC command.
     * CT outputs use ECDSA signatures and standard scriptPubKey, while the outputs
     * are created as RingCT outputs with full privacy.
     *
     * @param spendKey - Spend private key
     * @param scanKey - Scan private key
     * @param recipients - Recipients and amounts
     * @param ctUtxos - CT UTXOs to spend
     * @returns Built transaction result
     *
     * @example
     * ```typescript
     * const result = await txBuilder.sendStealthToRingCT(
     *   spendKey,
     *   scanKey,
     *   [{ address: 'sv1qq...', amount: 100000000n }],
     *   myCTUtxos
     * );
     * console.log('TX:', result.txHex);
     * ```
     */
    async sendStealthToRingCT(spendKey, scanKey, recipients, ctUtxos) {
      if (!this.wasmInitialized) {
        await this.initialize();
      }
      debug("[sendStealthToRingCT] Starting CT -> RingCT transaction build");
      debug(`[sendStealthToRingCT] Recipients: ${recipients.length}, CT UTXOs: ${ctUtxos.length}`);
      if (recipients.length === 0) {
        throw new Error("At least one recipient is required");
      }
      if (ctUtxos.length === 0) {
        throw new Error("At least one CT UTXO is required");
      }
      let totalOutputAmount = 0n;
      for (const r of recipients) {
        if (r.amount <= 0n) {
          throw new Error("Recipient amount must be positive");
        }
        totalOutputAmount += r.amount;
      }
      let totalInputAmount = 0n;
      for (const utxo of ctUtxos) {
        totalInputAmount += utxo.amount;
      }
      debug(`[sendStealthToRingCT] Total input: ${satoshisToVeil(totalInputAmount)} VEIL`);
      debug(`[sendStealthToRingCT] Total output: ${satoshisToVeil(totalOutputAmount)} VEIL`);
      const estimatedInputSize = ctUtxos.length * 150;
      const estimatedOutputSize = (recipients.length + 1) * 5500;
      const estimatedSize = 10 + estimatedInputSize + estimatedOutputSize + 100;
      const estimatedFee = BigInt(Math.ceil(estimatedSize / 1e3)) * BigInt(this.config.feePerKb);
      debug(`[sendStealthToRingCT] Estimated size: ${estimatedSize} bytes`);
      debug(`[sendStealthToRingCT] Estimated fee: ${satoshisToVeil(estimatedFee)} VEIL`);
      const totalNeeded = totalOutputAmount + estimatedFee;
      if (totalInputAmount < totalNeeded) {
        throw new Error(`Insufficient funds: need ${satoshisToVeil(totalNeeded)} VEIL, have ${satoshisToVeil(totalInputAmount)} VEIL`);
      }
      const changeAmount = totalInputAmount - totalNeeded;
      debug(`[sendStealthToRingCT] Change amount: ${satoshisToVeil(changeAmount)} VEIL`);
      const inputs = [];
      const inputBlinds = [];
      for (const utxo of ctUtxos) {
        const input = {
          prevout: {
            hash: hexToBytes(utxo.txid).reverse(),
            // Convert to internal byte order
            n: utxo.vout
          },
          scriptSig: new Uint8Array(0),
          // Will be filled after signing
          nSequence: SEQUENCE_FINAL
        };
        inputs.push(input);
        inputBlinds.push(utxo.blind);
      }
      const outputs = [];
      const outputBlinds = [];
      const outputCommitments = [];
      const feeOutput = {
        type: 4 /* OUTPUT_DATA */,
        address: "",
        amount: 0n,
        vData: this.encodeFeeData(estimatedFee)
      };
      outputs.push(feeOutput);
      const spendPubkey = derivePublicKey2(spendKey);
      const scanPubkey = derivePublicKey2(scanKey);
      const hasChange = changeAmount > DUST_THRESHOLD;
      const changeAddress = hasChange ? generateStealthAddress(scanPubkey, spendPubkey) : null;
      const allOutputsToCreate = [];
      for (const recipient of recipients) {
        allOutputsToCreate.push({ address: recipient.address, amount: recipient.amount });
      }
      if (hasChange && changeAddress) {
        allOutputsToCreate.push({ address: changeAddress, amount: changeAmount });
      }
      for (let i = 0; i < allOutputsToCreate.length - 1; i++) {
        const { address, amount } = allOutputsToCreate[i];
        const outputResult = await this.buildRingCTOutput(address, amount);
        outputs.push(outputResult.output);
        outputBlinds.push(outputResult.blind);
        outputCommitments.push(outputResult.commitment);
      }
      const lastOutput = allOutputsToCreate[allOutputsToCreate.length - 1];
      const blindsForSum = [...inputBlinds, ...outputBlinds];
      const nPositive = inputBlinds.length;
      const lastBlind = sumBlinds(blindsForSum, nPositive);
      debug(`[sendStealthToRingCT] Calculated balancing blind for last output`);
      const lastOutputResult = await this.buildRingCTOutputWithBlind(
        lastOutput.address,
        lastOutput.amount,
        lastBlind
      );
      outputs.push(lastOutputResult.output);
      outputBlinds.push(lastBlind);
      outputCommitments.push(lastOutputResult.commitment);
      const partialTx = {
        version: 2,
        inputs: inputs.map((inp) => ({
          prevout: inp.prevout,
          nSequence: inp.nSequence
        })),
        outputs,
        lockTime: 0
      };
      for (let i = 0; i < ctUtxos.length; i++) {
        const utxo = ctUtxos[i];
        const outputSpendKey = await deriveCTSpendKey(spendKey, scanKey, utxo.ephemeralPubkey);
        const outputPubkey = derivePublicKey2(outputSpendKey);
        const sighash = await computeCTSighash(
          partialTx,
          i,
          utxo.scriptPubKey,
          utxo.commitment,
          SIGHASH_ALL
        );
        const signature = ecdsaSign(sighash, outputSpendKey);
        const scriptSig = createP2PKHScriptSig(signature, outputPubkey, SIGHASH_ALL);
        inputs[i].scriptSig = scriptSig;
      }
      const txHex = await this.serializeCTToRingCTTransaction(inputs, outputs, estimatedFee);
      const txBytes = hexToBytes(txHex);
      const txidBytes = await doubleSha256(txBytes);
      const txid = bytesToHex(txidBytes.reverse());
      debug(`[sendStealthToRingCT] Transaction built successfully`);
      debug(`[sendStealthToRingCT] TXID: ${txid}`);
      debug(`[sendStealthToRingCT] Size: ${txBytes.length} bytes`);
      debug(`[sendStealthToRingCT] Fee: ${satoshisToVeil(estimatedFee)} VEIL`);
      return {
        txHex,
        txid,
        fee: estimatedFee,
        change: changeAmount,
        size: txBytes.length,
        inputs: ctUtxos,
        // CT UTXOs (different type, cast for interface)
        outputs
      };
    }
    /**
     * Build a RingCT output for CT -> RingCT transactions
     */
    async buildRingCTOutput(address, amount) {
      const ephemeralResult = await generateEphemeralKeys(address);
      const blind = getRandomBytes(32);
      const commitment = createCommitment(amount, blind);
      const rangeProofParams = selectRangeProofParameters(amount);
      const rangeProof = generateRangeProof({
        commitment,
        value: amount,
        blind,
        nonce: ephemeralResult.sharedSecret,
        message: new Uint8Array(0),
        minValue: 0n,
        exp: rangeProofParams.exponent,
        minBits: rangeProofParams.minBits
      });
      const vData = concatBytes(
        new Uint8Array([33]),
        // Push 33 bytes
        ephemeralResult.ephemeralPubkey
      );
      const output = {
        type: 3 /* OUTPUT_RINGCT */,
        address,
        amount,
        pk: ephemeralResult.destPubkey,
        commitment,
        vData,
        vRangeproof: rangeProof.proof,
        blind
      };
      return { output, blind, commitment };
    }
    /**
     * Build a RingCT output with a specific blind (for commitment balancing)
     */
    async buildRingCTOutputWithBlind(address, amount, blind) {
      const ephemeralResult = await generateEphemeralKeys(address);
      const commitment = createCommitment(amount, blind);
      const rangeProofParams = selectRangeProofParameters(amount);
      const rangeProof = generateRangeProof({
        commitment,
        value: amount,
        blind,
        nonce: ephemeralResult.sharedSecret,
        message: new Uint8Array(0),
        minValue: 0n,
        exp: rangeProofParams.exponent,
        minBits: rangeProofParams.minBits
      });
      const vData = concatBytes(
        new Uint8Array([33]),
        // Push 33 bytes
        ephemeralResult.ephemeralPubkey
      );
      const output = {
        type: 3 /* OUTPUT_RINGCT */,
        address,
        amount,
        pk: ephemeralResult.destPubkey,
        commitment,
        vData,
        vRangeproof: rangeProof.proof,
        blind
      };
      return { output, commitment };
    }
    /**
     * Encode fee data for OUTPUT_DATA
     */
    encodeFeeData(fee) {
      const feeBytes = [6 /* DO_FEE */];
      let remaining = fee;
      do {
        let byte = Number(remaining & 0x7fn);
        remaining = remaining >> 7n;
        if (remaining > 0n) {
          byte |= 128;
        }
        feeBytes.push(byte);
      } while (remaining > 0n);
      return new Uint8Array(feeBytes);
    }
    /**
     * Serialize a CT -> RingCT transaction
     *
     * Veil transaction format (from transaction.h:722):
     * 1. Version low byte (1 byte)
     * 2. Transaction type (1 byte) - high byte of version
     * 3. Has witness flag (1 byte)
     * 4. Lock time (4 bytes)
     * 5. Inputs (with varint count)
     * 6. Outputs (with varint count, each prefixed by output type)
     * 7. Witness data (if has witness)
     */
    async serializeCTToRingCTTransaction(inputs, outputs, fee) {
      const parts = [];
      const version = 2;
      const txType = 0;
      parts.push(new Uint8Array([version & 255]));
      parts.push(new Uint8Array([txType & 255]));
      parts.push(new Uint8Array([0]));
      const lockTimeBytes = new Uint8Array(4);
      parts.push(lockTimeBytes);
      parts.push(this.encodeVarInt(BigInt(inputs.length)));
      for (const input of inputs) {
        parts.push(serializeCTInput(input));
      }
      parts.push(this.encodeVarInt(BigInt(outputs.length)));
      for (const output of outputs) {
        parts.push(serializeOutput(output));
      }
      return bytesToHex(concatBytes(...parts));
    }
  };

  // src/scanner.ts
  init_wasm();
  async function scanRingCTOutput(output, scanSecret, spendPubkey) {
    try {
      if (output.vData.length < 34) {
        return { isMine: false };
      }
      const ephemeralPubkey = output.vData.slice(1, 34);
      const hash = performEcdh(ephemeralPubkey, scanSecret);
      const expectedPubkey = pointAddScalar2(spendPubkey, hash);
      if (bytesToHex(expectedPubkey) !== bytesToHex(output.pk)) {
        return { isMine: false };
      }
      let value;
      let blind;
      try {
        const rewindResult = rewindRangeProof(
          hash,
          // nonce (simplified - may not work)
          output.commitment,
          // commitment
          output.vRangeproof
          // proof
        );
        value = rewindResult.value;
        blind = rewindResult.blind;
      } catch (e) {
        console.warn("Failed to rewind range proof:", e);
      }
      return {
        isMine: true,
        value,
        blind,
        spendKey: hash,
        // The scalar to add to spend secret
        pubkey: output.pk
      };
    } catch (e) {
      console.error("Error scanning output:", e instanceof Error ? e.message : e);
      return { isMine: false };
    }
  }
  async function scanCTOutput(output, scanSecret, spendPubkey) {
    try {
      if (output.vData.length < 34) {
        return { isMine: false };
      }
      const ephemeralPubkey = output.vData.slice(1, 34);
      const sharedSecret = performEcdh(ephemeralPubkey, scanSecret);
      try {
        const rewindResult = rewindRangeProof(
          sharedSecret,
          // nonce
          output.commitment,
          // commitment
          output.vRangeproof
          // proof
        );
        return {
          isMine: true,
          value: rewindResult.value,
          blind: rewindResult.blind,
          pubkey: ephemeralPubkey
        };
      } catch (e) {
      }
      return { isMine: false };
    } catch (e) {
      console.error("Error scanning CT output:", e instanceof Error ? e.message : e);
      return { isMine: false };
    }
  }
  async function scanOutput(output, scanSecret, spendPubkey) {
    switch (output.type) {
      case 3 /* OUTPUT_RINGCT */:
        if ("pk" in output && "commitment" in output && "vRangeproof" in output) {
          return scanRingCTOutput(output, scanSecret, spendPubkey);
        }
        break;
      case 2 /* OUTPUT_CT */:
        if ("commitment" in output && "vRangeproof" in output) {
          return scanCTOutput(output, scanSecret, spendPubkey);
        }
        break;
      case 1 /* OUTPUT_STANDARD */:
      case 4 /* OUTPUT_DATA */:
        return { isMine: false };
      default:
        return { isMine: false };
    }
    return { isMine: false };
  }
  async function scanTransaction(outputs, scanSecret, spendPubkey, txid) {
    const results = [];
    for (let vout = 0; vout < outputs.length; vout++) {
      const result = await scanOutput(outputs[vout], scanSecret, spendPubkey);
      if (result.isMine) {
        result.vout = vout;
        result.txid = txid;
      }
      results.push(result);
    }
    return results;
  }
  function scannedOutputToUTXO(scannedOutput, spendSecret, commitment, ephemeralPubkey, blockHeight) {
    if (!scannedOutput.isMine || !scannedOutput.value || !scannedOutput.blind) {
      return null;
    }
    const actualSpendKey = scannedOutput.spendKey ? privateAdd2(spendSecret, scannedOutput.spendKey) : spendSecret;
    return {
      txid: scannedOutput.txid || "",
      vout: scannedOutput.vout || 0,
      amount: scannedOutput.value,
      commitment,
      blind: scannedOutput.blind,
      pubkey: scannedOutput.pubkey || new Uint8Array(33),
      ephemeralPubkey,
      blockHeight: blockHeight || 0,
      spendable: true
    };
  }
  async function scanBlock(transactions, scanSecret, spendSecret, spendPubkey, blockHeight) {
    const utxos = [];
    for (const tx of transactions) {
      const scannedOutputs = await scanTransaction(
        tx.outputs,
        scanSecret,
        spendPubkey,
        tx.txid
      );
      for (let i = 0; i < scannedOutputs.length; i++) {
        const scanned = scannedOutputs[i];
        const output = tx.outputs[i];
        if (scanned.isMine && "commitment" in output && "vData" in output) {
          const ephemeralPubkey = output.vData.slice(1, 34);
          const utxo = scannedOutputToUTXO(
            scanned,
            spendSecret,
            output.commitment,
            ephemeralPubkey,
            blockHeight
          );
          if (utxo) {
            utxos.push(utxo);
          }
        }
      }
    }
    return utxos;
  }
  async function canSpendOutput(output, scanSecret, spendPubkey) {
    const result = await scanOutput(output, scanSecret, spendPubkey);
    return result.isMine;
  }
  function getTotalBalance(scannedOutputs) {
    return scannedOutputs.reduce((sum, output) => {
      if (output.isMine && output.value !== void 0) {
        return sum + output.value;
      }
      return sum;
    }, 0n);
  }

  // src/index.ts
  init_wasm();

  // src/buffer-reader.ts
  var BufferReader = class {
    constructor(buffer) {
      this.buffer = buffer;
      this.offset = 0;
    }
    /**
     * Get current offset position
     */
    getOffset() {
      return this.offset;
    }
    /**
     * Read unsigned 8-bit integer
     */
    readUInt8() {
      const value = new DataView(this.buffer.buffer, this.buffer.byteOffset).getUint8(
        this.offset
      );
      this.offset += 1;
      return value;
    }
    /**
     * Read signed 32-bit integer (little-endian)
     */
    readInt32() {
      const value = new DataView(this.buffer.buffer, this.buffer.byteOffset).getInt32(
        this.offset,
        true
        // little-endian
      );
      this.offset += 4;
      return value;
    }
    /**
     * Read unsigned 32-bit integer (little-endian)
     */
    readUInt32() {
      const value = new DataView(this.buffer.buffer, this.buffer.byteOffset).getUint32(
        this.offset,
        true
        // little-endian
      );
      this.offset += 4;
      return value;
    }
    /**
     * Read unsigned 64-bit integer (little-endian)
     * Returns as number (may lose precision for very large values)
     */
    readUInt64() {
      const low = new DataView(this.buffer.buffer, this.buffer.byteOffset).getUint32(
        this.offset,
        true
      );
      const high = new DataView(this.buffer.buffer, this.buffer.byteOffset).getUint32(
        this.offset + 4,
        true
      );
      this.offset += 8;
      return high * 4294967296 + low;
    }
    /**
     * Read fixed-size slice of bytes
     */
    readSlice(size) {
      const slice = this.buffer.slice(this.offset, this.offset + size);
      this.offset += size;
      return slice;
    }
    /**
     * Read variable-length integer (Bitcoin VarInt format)
     */
    readVarInt() {
      const first = this.readUInt8();
      if (first < 253) {
        return first;
      }
      if (first === 253) {
        const value = new DataView(this.buffer.buffer, this.buffer.byteOffset).getUint16(
          this.offset,
          true
        );
        this.offset += 2;
        return value;
      }
      if (first === 254) {
        const value = new DataView(this.buffer.buffer, this.buffer.byteOffset).getUint32(
          this.offset,
          true
        );
        this.offset += 4;
        return value;
      }
      const lo = new DataView(this.buffer.buffer, this.buffer.byteOffset).getUint32(
        this.offset,
        true
      );
      this.offset += 4;
      const hi = new DataView(this.buffer.buffer, this.buffer.byteOffset).getUint32(
        this.offset,
        true
      );
      this.offset += 4;
      const number = hi * 4294967296 + lo;
      if (number > Number.MAX_SAFE_INTEGER) {
        throw new Error("VarInt exceeds safe integer range");
      }
      return number;
    }
    /**
     * Read variable-length byte slice
     * First reads VarInt for length, then reads that many bytes
     */
    readVarSlice() {
      const length = this.readVarInt();
      return this.readSlice(length);
    }
    /**
     * Get remaining bytes in buffer
     */
    remaining() {
      return this.buffer.length - this.offset;
    }
    /**
     * Check if there are bytes remaining
     */
    hasMore() {
      return this.offset < this.buffer.length;
    }
  };

  // src/watch-only-tx.ts
  init_wasm();
  init_debug();
  var WatchOnlyTxType = /* @__PURE__ */ ((WatchOnlyTxType2) => {
    WatchOnlyTxType2[WatchOnlyTxType2["NOTSET"] = -1] = "NOTSET";
    WatchOnlyTxType2[WatchOnlyTxType2["STEALTH"] = 0] = "STEALTH";
    WatchOnlyTxType2[WatchOnlyTxType2["ANON"] = 1] = "ANON";
    return WatchOnlyTxType2;
  })(WatchOnlyTxType || {});
  var CTxOutCT = class {
    /**
     * Deserialize CT output from buffer
     *
     * Format (from Veil Core):
     * - commitment (33 bytes)
     * - vData (varlen, first 33 bytes is ephemeral pubkey)
     * - scriptPubKey (varlen)
     * - vRangeproof (varlen)
     */
    deserialize(buffer) {
      const reader = new BufferReader(buffer);
      this.commitment = reader.readSlice(33);
      this.vData = reader.readVarSlice();
      this.scriptPubKey = reader.readVarSlice();
      this.vRangeproof = reader.readVarSlice();
      if (this.vData && this.vData.length >= 33) {
        this.vchEphemPK = this.vData.slice(0, 33);
      }
    }
    /**
     * Decode CT transaction to extract amount and blind
     *
     * @param spendSecret - Spend private key
     * @param scanSecret - Scan private key
     */
    async decodeTx(spendSecret, scanSecret) {
      if (!this.vchEphemPK || !this.commitment || !this.vRangeproof) {
        throw new Error("CT Transaction not deserialized");
      }
      try {
        const spendPubkey = derivePublicKey2(spendSecret);
        debug("[decodeCTTx] Spend pubkey derived");
        const sShared = performEcdh(this.vchEphemPK, scanSecret);
        debug("[decodeCTTx] ECDH shared secret:", sShared.length, "bytes");
        const destinationKeyPriv = privateAdd(spendSecret, sShared);
        debug("[decodeCTTx] Destination key derived");
        this.derivedPubkey = derivePublicKey2(destinationKeyPriv);
        debug("[decodeCTTx] Derived pubkey:", bytesToHex(this.derivedPubkey).slice(0, 40) + "...");
        if (this.scriptPubKey && this.scriptPubKey.length === 25) {
          const scriptPubkeyHash = this.scriptPubKey.slice(3, 23);
          const derivedHash = await hash160(this.derivedPubkey);
          if (bytesToHex(scriptPubkeyHash) !== bytesToHex(derivedHash)) {
            throw new Error("Derived pubkey hash does not match scriptPubKey - transaction not for this wallet");
          }
          debug("[decodeCTTx] \u2705 ScriptPubKey verified");
        }
        const wasm = getWasm();
        const ecdhResult = performEcdh(this.vchEphemPK, destinationKeyPriv);
        const nonceHashed = wasm.hashSha256(ecdhResult);
        debug("[decodeCTTx] Nonce from ECDH (double SHA256):", nonceHashed.length, "bytes");
        try {
          const rewound = rewindRangeProof(nonceHashed, this.commitment, this.vRangeproof);
          if (rewound) {
            this.nAmount = rewound.value;
            this.blind = rewound.blind;
            debug("[decodeCTTx] \u2705 Range proof rewound! Amount:", this.nAmount);
          }
        } catch (rewindError) {
          debug("[decodeCTTx] Range proof rewind failed:", rewindError.message);
        }
      } catch (error) {
        throw error;
      }
    }
    // Getters
    getCommitment() {
      return this.commitment;
    }
    getScriptPubKey() {
      return this.scriptPubKey;
    }
    getVCHEphemPK() {
      return this.vchEphemPK;
    }
    getVData() {
      return this.vData;
    }
    getRangeProof() {
      return this.vRangeproof;
    }
    getAmount() {
      return this.nAmount;
    }
    getBlind() {
      return this.blind;
    }
    getDerivedPubkey() {
      return this.derivedPubkey;
    }
    // Setters
    setAmount(amount) {
      this.nAmount = amount;
    }
    setBlind(blind) {
      this.blind = blind;
    }
  };
  var CTxOutRingCT = class {
    /**
     * Deserialize RingCT output from buffer
     */
    deserialize(buffer) {
      const reader = new BufferReader(buffer);
      this.pubKey = reader.readSlice(33);
      this.commitment = reader.readSlice(33);
      this.vData = reader.readVarSlice();
      this.vRangeproof = reader.readVarSlice();
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
    async decodeTx(spendSecret, scanSecret) {
      if (!this.pubKey || !this.vchEphemPK || !this.commitment || !this.vRangeproof) {
        throw new Error("Transaction not deserialized");
      }
      try {
        const spendPubkey = derivePublicKey2(spendSecret);
        debug("[decodeTx] Spend pubkey derived");
        const sShared = performEcdh(this.vchEphemPK, scanSecret);
        debug("[decodeTx] ECDH shared secret (hashed):", sShared.length, "bytes");
        const destinationKeyPriv = privateAdd(spendSecret, sShared);
        debug("[decodeTx] Destination key derived (using scalar addition)");
        const derivedPubkey = derivePublicKey2(destinationKeyPriv);
        debug("[decodeTx] Derived pubkey:", bytesToHex(derivedPubkey).slice(0, 40) + "...");
        debug("[decodeTx] Expected pubkey:", bytesToHex(this.pubKey).slice(0, 40) + "...");
        if (bytesToHex(derivedPubkey) !== bytesToHex(this.pubKey)) {
          throw new Error("Derived destination pubkey does not match transaction pubkey - transaction not for this wallet");
        }
        debug("[decodeTx] \u2705 Destination pubkey verified");
        this.keyImage = generateKeyImage(this.pubKey, destinationKeyPriv);
        debug("[decodeTx] Key image generated");
        const wasm = getWasm();
        const ecdhResult = performEcdh(this.vchEphemPK, destinationKeyPriv);
        const nonceHashed = wasm.hashSha256(ecdhResult);
        debug("[decodeTx] Nonce from ECDH (double SHA256):", nonceHashed.length, "bytes");
        debug("[decodeTx] Attempting range proof rewind...");
        debug("[decodeTx]   Nonce:", nonceHashed.length, "bytes");
        debug("[decodeTx]   Nonce (hex):", bytesToHex(nonceHashed));
        debug("[decodeTx]   Commitment:", this.commitment.length, "bytes");
        debug("[decodeTx]   Commitment (hex):", bytesToHex(this.commitment));
        debug("[decodeTx]   Proof:", this.vRangeproof.length, "bytes");
        debug("[decodeTx]   Proof (first 100 bytes):", bytesToHex(this.vRangeproof.slice(0, 100)));
        try {
          const rewound = rewindRangeProof(nonceHashed, this.commitment, this.vRangeproof);
          debug("[decodeTx] Range proof rewind result:", rewound);
          if (rewound) {
            this.nAmount = rewound.value;
            this.blind = rewound.blind;
            debug("[decodeTx] \u2705 Successfully rewound range proof! Amount:", this.nAmount);
          } else {
            debug("[decodeTx] \u26A0\uFE0F  Rewind returned null/undefined");
          }
        } catch (rewindError) {
        }
      } catch (error) {
        throw error;
      }
    }
    // Getters
    getPubKey() {
      return this.pubKey;
    }
    getKeyImage() {
      return this.keyImage;
    }
    getAmount() {
      return this.nAmount;
    }
    getVCHEphemPK() {
      return this.vchEphemPK;
    }
    getVData() {
      return this.vData;
    }
    getCommitment() {
      return this.commitment;
    }
    getBlind() {
      return this.blind;
    }
    getRangeProof() {
      return this.vRangeproof;
    }
    // Setters (for when amount/blind come from external source like RPC)
    setAmount(amount) {
      this.nAmount = amount;
    }
    setBlind(blind) {
      this.blind = blind;
    }
  };
  var CWatchOnlyTx = class {
    /**
     * Deserialize watch-only transaction from buffer
     */
    deserialize(buffer) {
      const reader = new BufferReader(buffer);
      const typeValue = reader.readInt32();
      switch (typeValue) {
        case 0:
          this.type = 0 /* STEALTH */;
          break;
        case 1:
          this.type = 1 /* ANON */;
          break;
        default:
          this.type = -1 /* NOTSET */;
      }
      this.scanSecret = reader.readSlice(32);
      reader.readUInt8();
      reader.readUInt8();
      this.txHash = reader.readSlice(32);
      this.txIndex = reader.readUInt32();
      const remainingBuffer = buffer.slice(reader.getOffset());
      if (this.type === 1 /* ANON */) {
        const ctxOut = new CTxOutRingCT();
        ctxOut.deserialize(remainingBuffer);
        this.ringctout = ctxOut;
      } else if (this.type === 0 /* STEALTH */) {
        const ctxOut = new CTxOutCT();
        ctxOut.deserialize(remainingBuffer);
        this.ctout = ctxOut;
      }
    }
    // Getters
    getType() {
      return this.type;
    }
    getScanSecret() {
      return this.scanSecret;
    }
    getTxIndex() {
      return this.txIndex;
    }
    getKeyImage() {
      if (!this.ringctout) {
        return void 0;
      }
      return this.ringctout.getKeyImage();
    }
    getAmount(coinValue = 100000000n) {
      if (!this.ringctout) {
        return 0;
      }
      const amount = this.ringctout.getAmount();
      if (!amount) {
        return 0;
      }
      return Number(amount) / Number(coinValue);
    }
    getRingCtOut() {
      return this.ringctout;
    }
    getCTOut() {
      return this.ctout;
    }
    getId() {
      if (this.txHashHex) {
        return this.txHashHex;
      }
      if (!this.txHash) {
        return "";
      }
      const reversed = new Uint8Array(this.txHash).reverse();
      this.txHashHex = bytesToHex(reversed);
      return this.txHashHex;
    }
    getTxHash() {
      return this.txHash;
    }
  };
  var CWatchOnlyTxWithIndex = class extends CWatchOnlyTx {
    constructor() {
      super(...arguments);
      this.raw = "";
    }
    /**
     * Deserialize from hex string (as returned by getwatchonlytxes)
     */
    deserializeFromHex(rawHex) {
      this.raw = rawHex;
      const buffer = hexToBytes(rawHex);
      this.deserialize(buffer);
    }
    /**
     * Deserialize from buffer
     */
    deserialize(buffer) {
      const reader = new BufferReader(buffer);
      this.ringctIndex = reader.readUInt64();
      const remainingBuffer = buffer.slice(8);
      super.deserialize(remainingBuffer);
    }
    getRingCtIndex() {
      return this.ringctIndex;
    }
    getRaw() {
      return this.raw;
    }
  };
  async function parseWatchOnlyTransactions(transactions, spendSecret, scanSecret, metadata) {
    const utxos = [];
    for (let i = 0; i < transactions.length; i++) {
      const rawTx = transactions[i];
      const txMetadata = metadata?.[i];
      try {
        const tx = new CWatchOnlyTxWithIndex();
        tx.deserializeFromHex(rawTx);
        if (tx.getType() !== 1 /* ANON */) {
          continue;
        }
        const ringCtOut = tx.getRingCtOut();
        if (!ringCtOut) {
          continue;
        }
        await ringCtOut.decodeTx(spendSecret, scanSecret);
        if (txMetadata?.amount !== void 0) {
          const amount2 = typeof txMetadata.amount === "string" ? BigInt(txMetadata.amount) : BigInt(txMetadata.amount);
          ringCtOut.setAmount(amount2);
          debug("[parseWatchOnlyTransactions] Using amount from RPC metadata:", amount2);
        }
        if (txMetadata?.blind !== void 0) {
          const blind2 = typeof txMetadata.blind === "string" ? hexToBytes(txMetadata.blind) : txMetadata.blind;
          ringCtOut.setBlind(blind2);
          debug("[parseWatchOnlyTransactions] Using blind from RPC metadata");
        }
        const amount = ringCtOut.getAmount();
        const commitment = ringCtOut.getCommitment();
        const blind = ringCtOut.getBlind();
        const pubkey = ringCtOut.getPubKey();
        const ephemeralPubkey = ringCtOut.getVCHEphemPK();
        const keyImage = ringCtOut.getKeyImage();
        const txId = tx.getId();
        const vout = tx.getTxIndex() || 0;
        debug(`[parseWatchOnlyTransactions] TX ${txId}:${vout}`);
        debug(`  - amount: ${amount ? "\u2705" : "\u274C MISSING"}`);
        debug(`  - commitment: ${commitment ? "\u2705" : "\u274C"}`);
        debug(`  - blind: ${blind ? "\u2705" : "\u274C MISSING"}`);
        debug(`  - pubkey: ${pubkey ? "\u2705" : "\u274C"}`);
        debug(`  - ephemeralPubkey: ${ephemeralPubkey ? "\u2705" : "\u274C"}`);
        debug(`  - keyImage: ${keyImage ? "\u2705" : "\u274C"}`);
        if (!commitment || !pubkey || !ephemeralPubkey || !keyImage) {
          continue;
        }
        if (!amount || !blind) {
        }
        const ringctIndex = txMetadata?.ringctIndex ?? tx.getRingCtIndex();
        utxos.push({
          txid: txId,
          vout,
          amount: amount || 0n,
          // Use 0 as placeholder if missing
          commitment,
          blind: blind || new Uint8Array(32),
          // Use zeros as placeholder if missing
          pubkey,
          ephemeralPubkey,
          keyImage,
          ringctIndex
        });
      } catch (error) {
        console.error(`Error parsing transaction: ${error}`);
      }
    }
    return utxos;
  }
  async function parseWatchOnlyTransactionsCT(transactions, spendSecret, scanSecret, metadata) {
    const utxos = [];
    for (let i = 0; i < transactions.length; i++) {
      const rawTx = transactions[i];
      const txMetadata = metadata?.[i];
      try {
        const tx = new CWatchOnlyTxWithIndex();
        tx.deserializeFromHex(rawTx);
        if (tx.getType() !== 0 /* STEALTH */) {
          continue;
        }
        const ctOut = tx.getCTOut();
        if (!ctOut) {
          continue;
        }
        await ctOut.decodeTx(spendSecret, scanSecret);
        if (txMetadata?.amount !== void 0) {
          const amount2 = typeof txMetadata.amount === "string" ? BigInt(txMetadata.amount) : BigInt(txMetadata.amount);
          ctOut.setAmount(amount2);
          debug("[parseWatchOnlyTransactionsCT] Using amount from RPC metadata:", amount2);
        }
        if (txMetadata?.blind !== void 0) {
          const blind2 = typeof txMetadata.blind === "string" ? hexToBytes(txMetadata.blind) : txMetadata.blind;
          ctOut.setBlind(blind2);
          debug("[parseWatchOnlyTransactionsCT] Using blind from RPC metadata");
        }
        const amount = ctOut.getAmount();
        const commitment = ctOut.getCommitment();
        const blind = ctOut.getBlind();
        const scriptPubKey = ctOut.getScriptPubKey();
        const pubkey = ctOut.getDerivedPubkey();
        const ephemeralPubkey = ctOut.getVCHEphemPK();
        const txId = tx.getId();
        const vout = tx.getTxIndex() || 0;
        debug(`[parseWatchOnlyTransactionsCT] TX ${txId}:${vout}`);
        debug(`  - amount: ${amount ? "\u2705" : "\u274C MISSING"}`);
        debug(`  - commitment: ${commitment ? "\u2705" : "\u274C"}`);
        debug(`  - blind: ${blind ? "\u2705" : "\u274C MISSING"}`);
        debug(`  - scriptPubKey: ${scriptPubKey ? "\u2705" : "\u274C"}`);
        debug(`  - pubkey: ${pubkey ? "\u2705" : "\u274C"}`);
        debug(`  - ephemeralPubkey: ${ephemeralPubkey ? "\u2705" : "\u274C"}`);
        if (!commitment || !scriptPubKey || !pubkey || !ephemeralPubkey) {
          debug(`[parseWatchOnlyTransactionsCT] Skipping - missing critical fields`);
          continue;
        }
        utxos.push({
          txid: txId,
          vout,
          amount: amount || 0n,
          commitment,
          blind: blind || new Uint8Array(32),
          scriptPubKey,
          pubkey,
          ephemeralPubkey
        });
      } catch (error) {
        console.error(`Error parsing CT transaction: ${error}`);
      }
    }
    return utxos;
  }

  // src/balance.ts
  init_debug();
  async function checkKeyImagesSpentStatus(keyImages, alreadyKnownSpent, keyImageBatchSize, rpc) {
    const keyImagesToCheck = keyImages.filter((ki) => {
      const hex = bytesToHex(ki);
      return !alreadyKnownSpent.has(hex);
    });
    if (keyImagesToCheck.length === 0) {
      return;
    }
    debug(`[checkKeyImagesSpentStatus] Checking ${keyImagesToCheck.length} key images`);
    for (let i = 0; i < keyImagesToCheck.length; i += keyImageBatchSize) {
      const batch = keyImagesToCheck.slice(i, i + keyImageBatchSize);
      const results = await rpc.checkKeyImages(batch);
      for (const result of results) {
        if (result.spent || result.spentinmempool) {
          alreadyKnownSpent.add(result.keyImage);
        }
      }
    }
  }
  function filterAndConvertUnspentUtxos(parsedUtxos, spentKeyImages) {
    const unspentUtxos = [];
    const unspentParsed = [];
    for (const parsedUtxo of parsedUtxos) {
      if (!parsedUtxo.keyImage || parsedUtxo.amount === void 0) {
        continue;
      }
      const isSpent = spentKeyImages.has(bytesToHex(parsedUtxo.keyImage));
      if (isSpent) {
        continue;
      }
      const utxo = {
        txid: parsedUtxo.txid || "",
        vout: parsedUtxo.vout || 0,
        amount: parsedUtxo.amount,
        commitment: parsedUtxo.commitment,
        blind: parsedUtxo.blind,
        pubkey: parsedUtxo.pubkey,
        ephemeralPubkey: parsedUtxo.ephemeralPubkey,
        blockHeight: 0,
        // Not available from RPC
        spendable: true,
        // Unspent means spendable
        ringctIndex: parsedUtxo.ringctIndex
      };
      unspentUtxos.push(utxo);
      unspentParsed.push(parsedUtxo);
    }
    return { unspentUtxos, unspentParsed };
  }
  function validateGetBalanceParams(spendSecret, scanSecret, options) {
    if (!spendSecret || !(spendSecret instanceof Uint8Array)) {
      throw new Error("Invalid spendSecret: must be a Uint8Array");
    }
    if (spendSecret.length !== 32) {
      throw new Error("Invalid spendSecret: must be 32 bytes");
    }
    if (!scanSecret || !(scanSecret instanceof Uint8Array)) {
      throw new Error("Invalid scanSecret: must be a Uint8Array");
    }
    if (scanSecret.length !== 32) {
      throw new Error("Invalid scanSecret: must be 32 bytes");
    }
    const { startIndex = 0, keyImageBatchSize = 1e3, onUtxoDiscovered, knownSpentKeyImages } = options;
    if (typeof startIndex !== "number" || startIndex < 0 || !Number.isInteger(startIndex)) {
      throw new Error("Invalid startIndex: must be a non-negative integer");
    }
    if (typeof keyImageBatchSize !== "number" || keyImageBatchSize < 1 || keyImageBatchSize > 1e4) {
      throw new Error("Invalid keyImageBatchSize: must be between 1 and 10000");
    }
    if (onUtxoDiscovered !== void 0 && typeof onUtxoDiscovered !== "function") {
      throw new Error("Invalid onUtxoDiscovered: must be a function");
    }
    if (knownSpentKeyImages) {
      const kiSet = knownSpentKeyImages instanceof Set ? knownSpentKeyImages : new Set(knownSpentKeyImages);
      for (const ki of kiSet) {
        if (typeof ki !== "string" || !/^[0-9a-fA-F]{66}$/.test(ki)) {
          throw new Error(`Invalid key image in knownSpentKeyImages: "${ki}" (must be 66-char hex string)`);
        }
      }
    }
  }
  async function getBalance(spendSecret, scanSecret, rpc = RpcRequester, options = {}) {
    validateGetBalanceParams(spendSecret, scanSecret, options);
    const {
      knownSpentKeyImages = [],
      startIndex = 0,
      keyImageBatchSize = 1e3,
      onUtxoDiscovered
    } = options;
    const knownSpentSet = knownSpentKeyImages instanceof Set ? knownSpentKeyImages : new Set(knownSpentKeyImages);
    debug("[getBalance] Starting balance fetch");
    debug(`[getBalance] Options: startIndex=${startIndex}, keyImageBatchSize=${keyImageBatchSize}`);
    debug(`[getBalance] Known spent key images: ${knownSpentSet.size}`);
    debug("[getBalance] Processing transactions in chunks for memory efficiency...");
    const allUnspentUtxos = [];
    let totalBalance = 0n;
    let currentIndex = startIndex;
    let totalOutputsScanned = 0;
    let totalOwnedOutputsFound = 0;
    let lastProcessedIndex = startIndex;
    const allSpentKeyImages = new Set(knownSpentSet);
    const scanSecretHex = bytesToHex(scanSecret);
    while (true) {
      debug(`[getBalance] \u2550\u2550\u2550 Processing page starting at index ${currentIndex} \u2550\u2550\u2550`);
      const response = await rpc.getWatchOnlyTxes(scanSecretHex, currentIndex);
      const anonTxs = response?.anon || [];
      if (!anonTxs || anonTxs.length === 0) {
        debug(`[getBalance] No more transactions (got ${anonTxs.length} results)`);
        break;
      }
      totalOutputsScanned += anonTxs.length;
      debug(`[getBalance] Step 1: Fetched ${anonTxs.length} RingCT transactions`);
      const txHexArray = anonTxs.map((item) => item.raw || item.hex || item);
      const metadata = anonTxs.map((item) => ({
        amount: item.amount,
        blind: item.blind,
        ringctIndex: item.ringct_index
      }));
      let pageParsedUtxos;
      try {
        pageParsedUtxos = await parseWatchOnlyTransactions(
          txHexArray,
          spendSecret,
          scanSecret,
          metadata
        );
        debug(`[getBalance] Step 2: Parsed ${pageParsedUtxos.length} owned UTXOs from this page`);
        totalOwnedOutputsFound += pageParsedUtxos.length;
      } catch (error) {
        debug(`[getBalance] Error parsing batch: ${error.message}`);
        throw new Error(`Failed to parse transactions at index ${currentIndex}: ${error.message}`);
      }
      const pageKeyImages = pageParsedUtxos.map((utxo) => utxo.keyImage).filter((ki) => ki !== void 0);
      debug(`[getBalance] Step 3: Checking ${pageKeyImages.length} key images`);
      await checkKeyImagesSpentStatus(
        pageKeyImages,
        allSpentKeyImages,
        keyImageBatchSize,
        rpc
      );
      const { unspentUtxos: pageUnspentUtxos, unspentParsed: pageUnspentParsed } = filterAndConvertUnspentUtxos(pageParsedUtxos, allSpentKeyImages);
      allUnspentUtxos.push(...pageUnspentUtxos);
      for (const utxo of pageUnspentUtxos) {
        totalBalance += utxo.amount;
      }
      debug(`[getBalance] Step 4: Found ${pageUnspentUtxos.length} unspent UTXOs in this page`);
      if (onUtxoDiscovered && pageUnspentParsed.length > 0) {
        debug(`[getBalance] Step 5: Calling callback with ${pageUnspentParsed.length} unspent UTXOs`);
        await onUtxoDiscovered(pageUnspentParsed);
      }
      const lastTx = anonTxs[anonTxs.length - 1];
      if (lastTx?.dbindex !== void 0) {
        lastProcessedIndex = lastTx.dbindex + 1;
        debug(`[getBalance] Updated lastProcessedIndex to ${lastProcessedIndex}`);
      }
      if (anonTxs.length < 1e3) {
        debug("[getBalance] Reached end of transactions (got less than 1000)");
        break;
      }
      currentIndex = lastProcessedIndex;
    }
    debug(`[getBalance] \u2550\u2550\u2550 Processing complete \u2550\u2550\u2550`);
    debug(`[getBalance] Total outputs scanned: ${totalOutputsScanned}`);
    debug(`[getBalance] Total owned outputs: ${totalOwnedOutputsFound}`);
    debug(`[getBalance] Total unspent UTXOs: ${allUnspentUtxos.length}`);
    debug(`[getBalance] Total balance: ${totalBalance}`);
    return {
      totalBalance,
      utxos: allUnspentUtxos,
      lastProcessedIndex,
      spentKeyImages: Array.from(allSpentKeyImages),
      totalOutputsScanned,
      ownedOutputsFound: totalOwnedOutputsFound
    };
  }
  function convertParsedCTToUtxo(parsedUtxos, spentOutpoints) {
    const unspentUtxos = [];
    const unspentParsed = [];
    for (const parsedUtxo of parsedUtxos) {
      if (!parsedUtxo.scriptPubKey || parsedUtxo.amount === void 0) {
        continue;
      }
      const outpoint = `${parsedUtxo.txid}:${parsedUtxo.vout}`;
      if (spentOutpoints.has(outpoint)) {
        continue;
      }
      const utxo = {
        txid: parsedUtxo.txid || "",
        vout: parsedUtxo.vout || 0,
        amount: parsedUtxo.amount,
        commitment: parsedUtxo.commitment,
        blind: parsedUtxo.blind,
        scriptPubKey: parsedUtxo.scriptPubKey,
        pubkey: parsedUtxo.pubkey,
        ephemeralPubkey: parsedUtxo.ephemeralPubkey,
        blockHeight: 0,
        spendable: true
      };
      unspentUtxos.push(utxo);
      unspentParsed.push(parsedUtxo);
    }
    return { unspentUtxos, unspentParsed };
  }
  async function getBalanceCT(spendSecret, scanSecret, rpc = RpcRequester, options = {}) {
    const {
      startIndex = 0,
      knownSpentOutpoints = [],
      onUtxoDiscovered
    } = options;
    const spentOutpoints = knownSpentOutpoints instanceof Set ? knownSpentOutpoints : new Set(knownSpentOutpoints);
    debug("[getBalanceCT] Starting CT balance fetch");
    debug(`[getBalanceCT] Options: startIndex=${startIndex}`);
    debug(`[getBalanceCT] Known spent outpoints: ${spentOutpoints.size}`);
    const allUnspentUtxos = [];
    let totalBalance = 0n;
    let currentIndex = startIndex;
    let totalOutputsScanned = 0;
    let totalOwnedOutputsFound = 0;
    let lastProcessedIndex = startIndex;
    const scanSecretHex = bytesToHex(scanSecret);
    while (true) {
      debug(`[getBalanceCT] \u2550\u2550\u2550 Processing page starting at index ${currentIndex} \u2550\u2550\u2550`);
      const response = await rpc.getWatchOnlyTxes(scanSecretHex, currentIndex);
      const stealthTxs = response?.stealth || [];
      if (!stealthTxs || stealthTxs.length === 0) {
        debug(`[getBalanceCT] No more CT transactions (got ${stealthTxs.length} results)`);
        break;
      }
      totalOutputsScanned += stealthTxs.length;
      debug(`[getBalanceCT] Fetched ${stealthTxs.length} CT transactions`);
      const txHexArray = stealthTxs.map((item) => item.raw || item.hex || item);
      const metadata = stealthTxs.map((item) => ({
        amount: item.amount,
        blind: item.blind
      }));
      let pageParsedUtxos;
      try {
        pageParsedUtxos = await parseWatchOnlyTransactionsCT(
          txHexArray,
          spendSecret,
          scanSecret,
          metadata
        );
        debug(`[getBalanceCT] Parsed ${pageParsedUtxos.length} owned CT UTXOs from this page`);
        totalOwnedOutputsFound += pageParsedUtxos.length;
      } catch (error) {
        debug(`[getBalanceCT] Error parsing batch: ${error.message}`);
        throw new Error(`Failed to parse CT transactions at index ${currentIndex}: ${error.message}`);
      }
      const { unspentUtxos: pageUnspentUtxos, unspentParsed: pageUnspentParsed } = convertParsedCTToUtxo(pageParsedUtxos, spentOutpoints);
      allUnspentUtxos.push(...pageUnspentUtxos);
      for (const utxo of pageUnspentUtxos) {
        totalBalance += utxo.amount;
      }
      debug(`[getBalanceCT] Found ${pageUnspentUtxos.length} unspent CT UTXOs in this page`);
      if (onUtxoDiscovered && pageUnspentParsed.length > 0) {
        debug(`[getBalanceCT] Calling callback with ${pageUnspentParsed.length} CT UTXOs`);
        await onUtxoDiscovered(pageUnspentParsed);
      }
      const lastTx = stealthTxs[stealthTxs.length - 1];
      if (lastTx?.dbindex !== void 0) {
        lastProcessedIndex = lastTx.dbindex + 1;
      }
      if (stealthTxs.length < 1e3) {
        debug("[getBalanceCT] Reached end of CT transactions");
        break;
      }
      currentIndex = lastProcessedIndex;
    }
    debug(`[getBalanceCT] \u2550\u2550\u2550 Processing complete \u2550\u2550\u2550`);
    debug(`[getBalanceCT] Total CT outputs scanned: ${totalOutputsScanned}`);
    debug(`[getBalanceCT] Total CT owned outputs: ${totalOwnedOutputsFound}`);
    debug(`[getBalanceCT] Total unspent CT UTXOs: ${allUnspentUtxos.length}`);
    debug(`[getBalanceCT] Total CT balance: ${totalBalance}`);
    return {
      totalBalance,
      utxos: allUnspentUtxos,
      lastProcessedIndex,
      totalOutputsScanned,
      ownedOutputsFound: totalOwnedOutputsFound
    };
  }

  // debug-ui/src/browser.ts
  var browser_default = src_exports;
  return __toCommonJS(browser_exports);
})();
//# sourceMappingURL=veil-wasm.bundle.js.map
