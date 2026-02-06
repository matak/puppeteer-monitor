/**
 * Constants for console filtering and HMR detection.
 */

/** Default patterns to ignore in console output. */
export const DEFAULT_IGNORE_PATTERNS = [
  'IndexedDBStorage',
  'BackendSync',
  'heartbeat',
  'Sending ping',
  'Received pong',
];

/** HMR (Hot Module Replacement) patterns to detect reloads. */
export const HMR_PATTERNS = [
  '[vite] hot updated',
  '[vite] page reloaded',
  '[vite] connected',
];
