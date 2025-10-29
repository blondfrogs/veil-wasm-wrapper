/**
 * Debug logging utilities
 *
 * Set DEBUG environment variable or call setDebug(true) to enable debug logging
 */

let debugEnabled =
  typeof process !== 'undefined' && process.env?.DEBUG === 'true';

/**
 * Enable or disable debug logging
 */
export function setDebug(enabled: boolean): void {
  debugEnabled = enabled;
}

/**
 * Check if debug logging is enabled
 */
export function isDebugEnabled(): boolean {
  return debugEnabled;
}

/**
 * Log debug message (only if debug is enabled)
 */
export function debug(...args: any[]): void {
  if (debugEnabled) {
    console.log('[veil-wasm]', ...args);
  }
}

/**
 * Log debug group (only if debug is enabled)
 */
export function debugGroup(label: string, fn: () => void): void {
  if (debugEnabled) {
    console.group(`[veil-wasm] ${label}`);
    fn();
    console.groupEnd();
  }
}
