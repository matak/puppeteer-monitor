/**
 * Single-line status output – overwrites same line, no line inflation.
 * Use during long operations (join, connect, etc.) to show progress.
 */

/** Strip ANSI codes for display length. */
function stripAnsi(s) {
  return String(s).replace(/\x1b\[[0-9;]*m/g, '');
}

let lastLength = 0;
const INDENT = '  ';

/**
 * Write status message on current line (overwrites previous).
 * Only works when stdout is TTY.
 * @param {string} msg - Message (may contain ANSI)
 */
export function writeStatusLine(msg) {
  if (!process.stdout.isTTY) return;
  const plain = stripAnsi(msg);
  const full = INDENT + msg;
  const pad = lastLength > plain.length + INDENT.length ? ' '.repeat(lastLength - plain.length - INDENT.length) : '';
  lastLength = Math.max(lastLength, plain.length + INDENT.length);
  process.stdout.write('\r' + full + pad);
}

/**
 * Clear status line. Optionally add newline so next output starts on fresh line.
 * Call before prompts or when done.
 * @param {boolean} [ensureNewline=false] - If true, write \\n after clearing
 */
export function clearStatusLine(ensureNewline = false) {
  if (!process.stdout.isTTY || lastLength === 0) return;
  process.stdout.write('\r' + ' '.repeat(lastLength) + '\r');
  if (ensureNewline) process.stdout.write('\n');
  lastLength = 0;
}

