/**
 * Timestamp helpers for console and file output.
 */

/** HH:MM:SS.mmm for console output */
export function getTimestamp() {
  return new Date().toISOString().substring(11, 23);
}

/** Full ISO timestamp for file output */
export function getFullTimestamp() {
  return new Date().toISOString();
}
