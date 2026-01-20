
let imports = {};
imports['__wbindgen_placeholder__'] = module.exports;

let cachedUint8ArrayMemory0 = null;

function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });

cachedTextDecoder.decode();

function decodeText(ptr, len) {
    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

function getStringFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return decodeText(ptr, len);
}

let heap = new Array(128).fill(undefined);

heap.push(undefined, null, true, false);

let heap_next = heap.length;

function addHeapObject(obj) {
    if (heap_next === heap.length) heap.push(heap.length + 1);
    const idx = heap_next;
    heap_next = heap[idx];

    heap[idx] = obj;
    return idx;
}

function getObject(idx) { return heap[idx]; }

let WASM_VECTOR_LEN = 0;

const cachedTextEncoder = new TextEncoder();

if (!('encodeInto' in cachedTextEncoder)) {
    cachedTextEncoder.encodeInto = function (arg, view) {
        const buf = cachedTextEncoder.encode(arg);
        view.set(buf);
        return {
            read: arg.length,
            written: buf.length
        };
    }
}

function passStringToWasm0(arg, malloc, realloc) {

    if (realloc === undefined) {
        const buf = cachedTextEncoder.encode(arg);
        const ptr = malloc(buf.length, 1) >>> 0;
        getUint8ArrayMemory0().subarray(ptr, ptr + buf.length).set(buf);
        WASM_VECTOR_LEN = buf.length;
        return ptr;
    }

    let len = arg.length;
    let ptr = malloc(len, 1) >>> 0;

    const mem = getUint8ArrayMemory0();

    let offset = 0;

    for (; offset < len; offset++) {
        const code = arg.charCodeAt(offset);
        if (code > 0x7F) break;
        mem[ptr + offset] = code;
    }

    if (offset !== len) {
        if (offset !== 0) {
            arg = arg.slice(offset);
        }
        ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
        const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
        const ret = cachedTextEncoder.encodeInto(arg, view);

        offset += ret.written;
        ptr = realloc(ptr, len, offset, 1) >>> 0;
    }

    WASM_VECTOR_LEN = offset;
    return ptr;
}

let cachedDataViewMemory0 = null;

function getDataViewMemory0() {
    if (cachedDataViewMemory0 === null || cachedDataViewMemory0.buffer.detached === true || (cachedDataViewMemory0.buffer.detached === undefined && cachedDataViewMemory0.buffer !== wasm.memory.buffer)) {
        cachedDataViewMemory0 = new DataView(wasm.memory.buffer);
    }
    return cachedDataViewMemory0;
}

function dropObject(idx) {
    if (idx < 132) return;
    heap[idx] = heap_next;
    heap_next = idx;
}

function takeObject(idx) {
    const ret = getObject(idx);
    dropObject(idx);
    return ret;
}
/**
 * Initialize panic hook for better error messages in the browser
 */
exports.init_panic_hook = function() {
    wasm.init_panic_hook();
};

function passArray8ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 1, 1) >>> 0;
    getUint8ArrayMemory0().set(arg, ptr / 1);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function getArrayU8FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint8ArrayMemory0().subarray(ptr / 1, ptr / 1 + len);
}
/**
 * Generate a key image from a public key and secret key
 *
 * # Arguments
 *
 * * `pk_bytes` - Public key (33 bytes compressed)
 * * `sk_bytes` - Secret key (32 bytes)
 *
 * # Returns
 *
 * Key image as a Uint8Array (33 bytes)
 *
 * # Errors
 *
 * Throws JavaScript error if the operation fails
 * @param {Uint8Array} pk_bytes
 * @param {Uint8Array} sk_bytes
 * @returns {Uint8Array}
 */
exports.getKeyImage = function(pk_bytes, sk_bytes) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
        const ptr0 = passArray8ToWasm0(pk_bytes, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArray8ToWasm0(sk_bytes, wasm.__wbindgen_export2);
        const len1 = WASM_VECTOR_LEN;
        wasm.getKeyImage(retptr, ptr0, len0, ptr1, len1);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
        var r3 = getDataViewMemory0().getInt32(retptr + 4 * 3, true);
        if (r3) {
            throw takeObject(r2);
        }
        var v3 = getArrayU8FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export(r0, r1 * 1, 1);
        return v3;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
};

/**
 * Perform ECDH_VEIL to generate a shared secret
 *
 * # Arguments
 *
 * * `pubkey_bytes` - Public key (33 or 65 bytes)
 * * `privkey_bytes` - Private key (32 bytes)
 *
 * # Returns
 *
 * Shared secret as a Uint8Array (32 bytes)
 * @param {Uint8Array} pubkey_bytes
 * @param {Uint8Array} privkey_bytes
 * @returns {Uint8Array}
 */
exports.ecdhVeil = function(pubkey_bytes, privkey_bytes) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
        const ptr0 = passArray8ToWasm0(pubkey_bytes, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArray8ToWasm0(privkey_bytes, wasm.__wbindgen_export2);
        const len1 = WASM_VECTOR_LEN;
        wasm.ecdhVeil(retptr, ptr0, len0, ptr1, len1);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
        var r3 = getDataViewMemory0().getInt32(retptr + 4 * 3, true);
        if (r3) {
            throw takeObject(r2);
        }
        var v3 = getArrayU8FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export(r0, r1 * 1, 1);
        return v3;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
};

/**
 * Create a Pedersen commitment
 *
 * # Arguments
 *
 * * `value` - The value to commit to
 * * `blind` - Blinding factor (32 bytes)
 *
 * # Returns
 *
 * Commitment as a Uint8Array (33 bytes)
 * @param {bigint} value
 * @param {Uint8Array} blind
 * @returns {Uint8Array}
 */
exports.pedersenCommit = function(value, blind) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
        const ptr0 = passArray8ToWasm0(blind, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        wasm.pedersenCommit(retptr, value, ptr0, len0);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
        var r3 = getDataViewMemory0().getInt32(retptr + 4 * 3, true);
        if (r3) {
            throw takeObject(r2);
        }
        var v2 = getArrayU8FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export(r0, r1 * 1, 1);
        return v2;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
};

/**
 * Sum blinding factors for balance proof
 *
 * # Arguments
 *
 * * `blinds` - Array of blinding factors (as JSON array of hex strings)
 * * `n_positive` - Number of positive blinds
 *
 * # Returns
 *
 * Resulting blind as a Uint8Array (32 bytes)
 * @param {string} blinds_json
 * @param {number} n_positive
 * @returns {Uint8Array}
 */
exports.pedersenBlindSum = function(blinds_json, n_positive) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
        const ptr0 = passStringToWasm0(blinds_json, wasm.__wbindgen_export2, wasm.__wbindgen_export3);
        const len0 = WASM_VECTOR_LEN;
        wasm.pedersenBlindSum(retptr, ptr0, len0, n_positive);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
        var r3 = getDataViewMemory0().getInt32(retptr + 4 * 3, true);
        if (r3) {
            throw takeObject(r2);
        }
        var v2 = getArrayU8FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export(r0, r1 * 1, 1);
        return v2;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
};

/**
 * Sign a range proof
 *
 * # Arguments
 *
 * * `commitment` - Pre-computed Pedersen commitment (33 bytes hex or bytes)
 * * `value` - The value to prove
 * * `blind` - Blinding factor (32 bytes)
 * * `nonce` - Nonce for rewinding (32 or 33 bytes, typically the commitment)
 * * `message` - Optional message to embed (max 256 bytes, pass empty for none)
 * * `min_value` - Minimum value for range (typically 0)
 * * `exp` - Base-10 exponent (-1 for auto)
 * * `min_bits` - Minimum bits to prove (0 for auto)
 *
 * # Returns
 *
 * JSON object with { proof, commitment, blind, nonce }
 * @param {Uint8Array} commitment
 * @param {bigint} value
 * @param {Uint8Array} blind
 * @param {Uint8Array} nonce
 * @param {Uint8Array} message
 * @param {bigint} min_value
 * @param {number} exp
 * @param {number} min_bits
 * @returns {string}
 */
exports.rangeproofSign = function(commitment, value, blind, nonce, message, min_value, exp, min_bits) {
    let deferred6_0;
    let deferred6_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
        const ptr0 = passArray8ToWasm0(commitment, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArray8ToWasm0(blind, wasm.__wbindgen_export2);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passArray8ToWasm0(nonce, wasm.__wbindgen_export2);
        const len2 = WASM_VECTOR_LEN;
        const ptr3 = passArray8ToWasm0(message, wasm.__wbindgen_export2);
        const len3 = WASM_VECTOR_LEN;
        wasm.rangeproofSign(retptr, ptr0, len0, value, ptr1, len1, ptr2, len2, ptr3, len3, min_value, exp, min_bits);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
        var r3 = getDataViewMemory0().getInt32(retptr + 4 * 3, true);
        var ptr5 = r0;
        var len5 = r1;
        if (r3) {
            ptr5 = 0; len5 = 0;
            throw takeObject(r2);
        }
        deferred6_0 = ptr5;
        deferred6_1 = len5;
        return getStringFromWasm0(ptr5, len5);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export(deferred6_0, deferred6_1, 1);
    }
};

/**
 * Verify a range proof
 *
 * # Arguments
 *
 * * `commitment` - Pedersen commitment (33 bytes)
 * * `proof` - Range proof
 *
 * # Returns
 *
 * JSON object with { minValue, maxValue } if valid, error otherwise
 * @param {Uint8Array} commitment
 * @param {Uint8Array} proof
 * @returns {string}
 */
exports.rangeproofVerify = function(commitment, proof) {
    let deferred4_0;
    let deferred4_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
        const ptr0 = passArray8ToWasm0(commitment, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArray8ToWasm0(proof, wasm.__wbindgen_export2);
        const len1 = WASM_VECTOR_LEN;
        wasm.rangeproofVerify(retptr, ptr0, len0, ptr1, len1);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
        var r3 = getDataViewMemory0().getInt32(retptr + 4 * 3, true);
        var ptr3 = r0;
        var len3 = r1;
        if (r3) {
            ptr3 = 0; len3 = 0;
            throw takeObject(r2);
        }
        deferred4_0 = ptr3;
        deferred4_1 = len3;
        return getStringFromWasm0(ptr3, len3);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export(deferred4_0, deferred4_1, 1);
    }
};

/**
 * Rewind a range proof to extract value
 *
 * # Arguments
 *
 * * `nonce` - Nonce used in proof (32 bytes)
 * * `commitment` - Pedersen commitment (33 bytes)
 * * `proof` - Range proof
 *
 * # Returns
 *
 * JSON object with { blind, value, minValue, maxValue, message }
 * @param {Uint8Array} nonce
 * @param {Uint8Array} commitment
 * @param {Uint8Array} proof
 * @returns {string}
 */
exports.rangeproofRewind = function(nonce, commitment, proof) {
    let deferred5_0;
    let deferred5_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
        const ptr0 = passArray8ToWasm0(nonce, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArray8ToWasm0(commitment, wasm.__wbindgen_export2);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passArray8ToWasm0(proof, wasm.__wbindgen_export2);
        const len2 = WASM_VECTOR_LEN;
        wasm.rangeproofRewind(retptr, ptr0, len0, ptr1, len1, ptr2, len2);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
        var r3 = getDataViewMemory0().getInt32(retptr + 4 * 3, true);
        var ptr4 = r0;
        var len4 = r1;
        if (r3) {
            ptr4 = 0; len4 = 0;
            throw takeObject(r2);
        }
        deferred5_0 = ptr4;
        deferred5_1 = len4;
        return getStringFromWasm0(ptr4, len4);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export(deferred5_0, deferred5_1, 1);
    }
};

/**
 * Prepare MLSAG signature data
 *
 * # Arguments
 *
 * * `m` - Matrix buffer (hex string)
 * * `n_outs` - Number of output commitments
 * * `n_blinded` - Number of blinded outputs
 * * `vp_in_commits_len` - Number of input commitments
 * * `vp_blinds_len` - Number of blinding factors
 * * `n_cols` - Number of columns (ring size)
 * * `n_rows` - Number of rows (inputs + 1)
 * * `pcm_in` - Input commitments (JSON array of hex strings)
 * * `pcm_out` - Output commitments (JSON array of hex strings)
 * * `blinds` - Blinding factors (JSON array of hex strings)
 *
 * # Returns
 *
 * JSON object with { m, sk } as hex strings
 * @param {string} m_hex
 * @param {number} n_outs
 * @param {number} n_blinded
 * @param {number} vp_in_commits_len
 * @param {number} vp_blinds_len
 * @param {number} n_cols
 * @param {number} n_rows
 * @param {string} pcm_in_json
 * @param {string} pcm_out_json
 * @param {string} blinds_json
 * @returns {string}
 */
exports.prepareMlsag = function(m_hex, n_outs, n_blinded, vp_in_commits_len, vp_blinds_len, n_cols, n_rows, pcm_in_json, pcm_out_json, blinds_json) {
    let deferred6_0;
    let deferred6_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
        const ptr0 = passStringToWasm0(m_hex, wasm.__wbindgen_export2, wasm.__wbindgen_export3);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(pcm_in_json, wasm.__wbindgen_export2, wasm.__wbindgen_export3);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passStringToWasm0(pcm_out_json, wasm.__wbindgen_export2, wasm.__wbindgen_export3);
        const len2 = WASM_VECTOR_LEN;
        const ptr3 = passStringToWasm0(blinds_json, wasm.__wbindgen_export2, wasm.__wbindgen_export3);
        const len3 = WASM_VECTOR_LEN;
        wasm.prepareMlsag(retptr, ptr0, len0, n_outs, n_blinded, vp_in_commits_len, vp_blinds_len, n_cols, n_rows, ptr1, len1, ptr2, len2, ptr3, len3);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
        var r3 = getDataViewMemory0().getInt32(retptr + 4 * 3, true);
        var ptr5 = r0;
        var len5 = r1;
        if (r3) {
            ptr5 = 0; len5 = 0;
            throw takeObject(r2);
        }
        deferred6_0 = ptr5;
        deferred6_1 = len5;
        return getStringFromWasm0(ptr5, len5);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export(deferred6_0, deferred6_1, 1);
    }
};

/**
 * Generate MLSAG signature
 *
 * # Arguments
 *
 * * `nonce` - Nonce for randomness (hex string, 32 bytes)
 * * `preimage` - Hash of transaction outputs (hex string, 32 bytes)
 * * `n_cols` - Number of columns (ring size)
 * * `n_rows` - Number of rows (inputs + 1)
 * * `index` - Index of real input in ring
 * * `sk` - Secret keys (JSON array of hex strings)
 * * `pk` - Public key matrix (hex string)
 *
 * # Returns
 *
 * JSON object with { keyImages, pc, ps } as hex strings
 * @param {string} nonce_hex
 * @param {string} preimage_hex
 * @param {number} n_cols
 * @param {number} n_rows
 * @param {number} index
 * @param {string} sk_json
 * @param {string} pk_hex
 * @returns {string}
 */
exports.generateMlsag = function(nonce_hex, preimage_hex, n_cols, n_rows, index, sk_json, pk_hex) {
    let deferred6_0;
    let deferred6_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
        const ptr0 = passStringToWasm0(nonce_hex, wasm.__wbindgen_export2, wasm.__wbindgen_export3);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(preimage_hex, wasm.__wbindgen_export2, wasm.__wbindgen_export3);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passStringToWasm0(sk_json, wasm.__wbindgen_export2, wasm.__wbindgen_export3);
        const len2 = WASM_VECTOR_LEN;
        const ptr3 = passStringToWasm0(pk_hex, wasm.__wbindgen_export2, wasm.__wbindgen_export3);
        const len3 = WASM_VECTOR_LEN;
        wasm.generateMlsag(retptr, ptr0, len0, ptr1, len1, n_cols, n_rows, index, ptr2, len2, ptr3, len3);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
        var r3 = getDataViewMemory0().getInt32(retptr + 4 * 3, true);
        var ptr5 = r0;
        var len5 = r1;
        if (r3) {
            ptr5 = 0; len5 = 0;
            throw takeObject(r2);
        }
        deferred6_0 = ptr5;
        deferred6_1 = len5;
        return getStringFromWasm0(ptr5, len5);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export(deferred6_0, deferred6_1, 1);
    }
};

/**
 * Verify MLSAG signature
 *
 * # Arguments
 *
 * * `preimage` - Hash of transaction outputs (hex string, 32 bytes)
 * * `n_cols` - Number of columns (ring size)
 * * `n_rows` - Number of rows (inputs + 1)
 * * `pk` - Public key matrix (hex string)
 * * `ki` - Key images (hex string)
 * * `pc` - First signature component (hex string, 32 bytes)
 * * `ps` - Second signature component (hex string)
 *
 * # Returns
 *
 * JSON object with { valid: true/false }
 * @param {string} preimage_hex
 * @param {number} n_cols
 * @param {number} n_rows
 * @param {string} pk_hex
 * @param {string} ki_hex
 * @param {string} pc_hex
 * @param {string} ps_hex
 * @returns {string}
 */
exports.verifyMlsag = function(preimage_hex, n_cols, n_rows, pk_hex, ki_hex, pc_hex, ps_hex) {
    let deferred7_0;
    let deferred7_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
        const ptr0 = passStringToWasm0(preimage_hex, wasm.__wbindgen_export2, wasm.__wbindgen_export3);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(pk_hex, wasm.__wbindgen_export2, wasm.__wbindgen_export3);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passStringToWasm0(ki_hex, wasm.__wbindgen_export2, wasm.__wbindgen_export3);
        const len2 = WASM_VECTOR_LEN;
        const ptr3 = passStringToWasm0(pc_hex, wasm.__wbindgen_export2, wasm.__wbindgen_export3);
        const len3 = WASM_VECTOR_LEN;
        const ptr4 = passStringToWasm0(ps_hex, wasm.__wbindgen_export2, wasm.__wbindgen_export3);
        const len4 = WASM_VECTOR_LEN;
        wasm.verifyMlsag(retptr, ptr0, len0, n_cols, n_rows, ptr1, len1, ptr2, len2, ptr3, len3, ptr4, len4);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
        var r3 = getDataViewMemory0().getInt32(retptr + 4 * 3, true);
        var ptr6 = r0;
        var len6 = r1;
        if (r3) {
            ptr6 = 0; len6 = 0;
            throw takeObject(r2);
        }
        deferred7_0 = ptr6;
        deferred7_1 = len6;
        return getStringFromWasm0(ptr6, len6);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export(deferred7_0, deferred7_1, 1);
    }
};

/**
 * Sign a message hash with ECDSA
 *
 * This produces a DER-encoded ECDSA signature suitable for use in
 * Bitcoin-style scriptSig when spending CT outputs.
 *
 * # Arguments
 *
 * * `message_hash` - 32-byte hash to sign (e.g., sighash)
 * * `secret_key` - 32-byte private key
 *
 * # Returns
 *
 * DER-encoded signature bytes
 * @param {Uint8Array} message_hash
 * @param {Uint8Array} secret_key
 * @returns {Uint8Array}
 */
exports.ecdsaSign = function(message_hash, secret_key) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
        const ptr0 = passArray8ToWasm0(message_hash, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArray8ToWasm0(secret_key, wasm.__wbindgen_export2);
        const len1 = WASM_VECTOR_LEN;
        wasm.ecdsaSign(retptr, ptr0, len0, ptr1, len1);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
        var r3 = getDataViewMemory0().getInt32(retptr + 4 * 3, true);
        if (r3) {
            throw takeObject(r2);
        }
        var v3 = getArrayU8FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export(r0, r1 * 1, 1);
        return v3;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
};

/**
 * Sign a message hash with ECDSA and return compact format
 *
 * # Arguments
 *
 * * `message_hash` - 32-byte hash to sign
 * * `secret_key` - 32-byte private key
 *
 * # Returns
 *
 * 64-byte compact signature (r || s)
 * @param {Uint8Array} message_hash
 * @param {Uint8Array} secret_key
 * @returns {Uint8Array}
 */
exports.ecdsaSignCompact = function(message_hash, secret_key) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
        const ptr0 = passArray8ToWasm0(message_hash, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArray8ToWasm0(secret_key, wasm.__wbindgen_export2);
        const len1 = WASM_VECTOR_LEN;
        wasm.ecdsaSignCompact(retptr, ptr0, len0, ptr1, len1);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
        var r3 = getDataViewMemory0().getInt32(retptr + 4 * 3, true);
        if (r3) {
            throw takeObject(r2);
        }
        var v3 = getArrayU8FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export(r0, r1 * 1, 1);
        return v3;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
};

/**
 * Hash data with SHA256
 * @param {Uint8Array} data
 * @returns {Uint8Array}
 */
exports.hashSha256 = function(data) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
        const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        wasm.hashSha256(retptr, ptr0, len0);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v2 = getArrayU8FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export(r0, r1 * 1, 1);
        return v2;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
};

/**
 * Hash data with Keccak256
 * @param {Uint8Array} data
 * @returns {Uint8Array}
 */
exports.hashKeccak256 = function(data) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
        const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        wasm.hashKeccak256(retptr, ptr0, len0);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v2 = getArrayU8FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export(r0, r1 * 1, 1);
        return v2;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
};

/**
 * Derive a public key from a secret key
 *
 * # Arguments
 *
 * * `secret` - Secret key (32 bytes)
 *
 * # Returns
 *
 * Public key as a Uint8Array (33 bytes compressed)
 * @param {Uint8Array} secret
 * @returns {Uint8Array}
 */
exports.derivePubkey = function(secret) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
        const ptr0 = passArray8ToWasm0(secret, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        wasm.derivePubkey(retptr, ptr0, len0);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
        var r3 = getDataViewMemory0().getInt32(retptr + 4 * 3, true);
        if (r3) {
            throw takeObject(r2);
        }
        var v2 = getArrayU8FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export(r0, r1 * 1, 1);
        return v2;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
};

/**
 * Add a scalar * G to a public key point
 *
 * result = pubkey + (scalar * G)
 *
 * # Arguments
 *
 * * `pubkey` - Public key (33 bytes compressed)
 * * `scalar` - Scalar value (32 bytes)
 *
 * # Returns
 *
 * Resulting public key as a Uint8Array (33 bytes)
 * @param {Uint8Array} pubkey
 * @param {Uint8Array} scalar
 * @returns {Uint8Array}
 */
exports.pointAddScalar = function(pubkey, scalar) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
        const ptr0 = passArray8ToWasm0(pubkey, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArray8ToWasm0(scalar, wasm.__wbindgen_export2);
        const len1 = WASM_VECTOR_LEN;
        wasm.pointAddScalar(retptr, ptr0, len0, ptr1, len1);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
        var r3 = getDataViewMemory0().getInt32(retptr + 4 * 3, true);
        if (r3) {
            throw takeObject(r2);
        }
        var v3 = getArrayU8FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export(r0, r1 * 1, 1);
        return v3;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
};

/**
 * Multiply a public key point by a scalar
 *
 * result = scalar * pubkey
 *
 * # Arguments
 *
 * * `pubkey` - Public key (33 bytes compressed)
 * * `scalar` - Scalar value (32 bytes)
 *
 * # Returns
 *
 * Resulting public key as a Uint8Array (33 bytes)
 * @param {Uint8Array} pubkey
 * @param {Uint8Array} scalar
 * @returns {Uint8Array}
 */
exports.pointMultiply = function(pubkey, scalar) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
        const ptr0 = passArray8ToWasm0(pubkey, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArray8ToWasm0(scalar, wasm.__wbindgen_export2);
        const len1 = WASM_VECTOR_LEN;
        wasm.pointMultiply(retptr, ptr0, len0, ptr1, len1);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
        var r3 = getDataViewMemory0().getInt32(retptr + 4 * 3, true);
        if (r3) {
            throw takeObject(r2);
        }
        var v3 = getArrayU8FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export(r0, r1 * 1, 1);
        return v3;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
};

/**
 * Add two private keys (mod curve order)
 *
 * result = (a + b) mod n
 *
 * # Arguments
 *
 * * `a` - First secret key (32 bytes)
 * * `b` - Second secret key (32 bytes)
 *
 * # Returns
 *
 * Resulting secret key as a Uint8Array (32 bytes)
 * @param {Uint8Array} a
 * @param {Uint8Array} b
 * @returns {Uint8Array}
 */
exports.privateAdd = function(a, b) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
        const ptr0 = passArray8ToWasm0(a, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArray8ToWasm0(b, wasm.__wbindgen_export2);
        const len1 = WASM_VECTOR_LEN;
        wasm.privateAdd(retptr, ptr0, len0, ptr1, len1);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
        var r3 = getDataViewMemory0().getInt32(retptr + 4 * 3, true);
        if (r3) {
            throw takeObject(r2);
        }
        var v3 = getArrayU8FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export(r0, r1 * 1, 1);
        return v3;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
};

exports.__wbg___wbindgen_throw_b855445ff6a94295 = function(arg0, arg1) {
    throw new Error(getStringFromWasm0(arg0, arg1));
};

exports.__wbg_error_7534b8e9a36f1ab4 = function(arg0, arg1) {
    let deferred0_0;
    let deferred0_1;
    try {
        deferred0_0 = arg0;
        deferred0_1 = arg1;
        console.error(getStringFromWasm0(arg0, arg1));
    } finally {
        wasm.__wbindgen_export(deferred0_0, deferred0_1, 1);
    }
};

exports.__wbg_new_8a6f238a6ece86ea = function() {
    const ret = new Error();
    return addHeapObject(ret);
};

exports.__wbg_stack_0ed75d68575b0f3c = function(arg0, arg1) {
    const ret = getObject(arg1).stack;
    const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_export2, wasm.__wbindgen_export3);
    const len1 = WASM_VECTOR_LEN;
    getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
    getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
};

exports.__wbindgen_cast_2241b6af4c4b2941 = function(arg0, arg1) {
    // Cast intrinsic for `Ref(String) -> Externref`.
    const ret = getStringFromWasm0(arg0, arg1);
    return addHeapObject(ret);
};

exports.__wbindgen_object_drop_ref = function(arg0) {
    takeObject(arg0);
};

const wasmPath = `${__dirname}/veil_wasm_bg.wasm`;
const wasmBytes = require('fs').readFileSync(wasmPath);
const wasmModule = new WebAssembly.Module(wasmBytes);
const wasm = exports.__wasm = new WebAssembly.Instance(wasmModule, imports).exports;

wasm.__wbindgen_start();

