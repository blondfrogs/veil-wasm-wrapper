/**
 * Browser entry point for veil-wasm-wrapper
 * Exports all functions to window.VeilWasm via esbuild's --global-name
 *
 * The initWasm function will automatically detect and use the preloaded
 * wasm_bindgen from veil_wasm.js script tag.
 */

import * as VeilWasm from '../../src/index';

// Export everything - esbuild's --global-name=VeilWasm exposes this on window.VeilWasm
export * from '../../src/index';
export default VeilWasm;
