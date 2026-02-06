/**
 * Logging submodule – buffer management, timestamps, dump actions.
 *
 * - constants.mjs  – DEFAULT_IGNORE_PATTERNS, HMR_PATTERNS
 * - timestamps.mjs  – getTimestamp, getFullTimestamp
 * - dump.mjs        – dumpBuffersToFiles, dumpCookiesFromPage, dumpDomFromPage
 * - LogBuffer.mjs   – LogBuffer class
 */

export { DEFAULT_IGNORE_PATTERNS, HMR_PATTERNS } from './constants.mjs';
export { getTimestamp, getFullTimestamp } from './timestamps.mjs';
export { LogBuffer } from './LogBuffer.mjs';
export { DOM_DUMP_MAX_BYTES } from './dump.mjs';
