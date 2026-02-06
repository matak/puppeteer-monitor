/**
 * Shared CLI table rendering via cli-table3.
 * Supports max width, word wrap, and consistent indent.
 */

import Table from 'cli-table3';

const INDENT = '  ';
const DEFAULT_MAX_WIDTH = 80;

/** Default table style – dim borders, no built-in header colors (we use C.xxx in content). */
const DEFAULT_TABLE_STYLE = {
  head: [],
  border: [],
  'padding-left': 1,
  'padding-right': 1,
};

/**
 * Compute max table width from terminal or param.
 * @param {number} [maxWidth] - Override max width; 0 = use terminal width
 * @returns {number}
 */
function getMaxWidth(maxWidth) {
  if (maxWidth != null && maxWidth > 0) return maxWidth;
  const cols = process.stdout.columns;
  if (cols && cols > 20) return Math.min(cols - 4, 100); // reserve space for indent
  return DEFAULT_MAX_WIDTH;
}

/**
 * Create a table with our default style.
 * @param {Object} opts - cli-table3 options (colWidths, head, style, chars, etc.)
 * @param {{ maxWidth?: number, wordWrap?: boolean }} [opts.tableOpts] - maxWidth, wordWrap
 * @returns {Table}
 */
export function createTable(opts = {}) {
  const { tableOpts = {}, colWidths, style: styleOverride, ...rest } = opts;
  const { maxWidth, wordWrap = false } = tableOpts;
  const style = { ...DEFAULT_TABLE_STYLE, ...styleOverride };
  const options = { style, ...rest };
  if (wordWrap) {
    options.wordWrap = true;
    const mw = getMaxWidth(maxWidth);
    const left = colWidths?.[0] ?? 12;
    options.colWidths = colWidths ?? [left, mw - left - 6];
  } else if (colWidths) {
    options.colWidths = colWidths;
  }
  return new Table(options);
}

/**
 * Render table to string with indent applied to each line.
 * @param {Table} table
 * @param {string} [indent]
 * @returns {string}
 */
export function formatTable(table, indent = INDENT) {
  const out = table.toString();
  return out.split('\n').map((l) => indent + l).join('\n');
}

/**
 * Print table with indent.
 * @param {Table} table
 * @param {string} [indent]
 */
export function printTable(table, indent = INDENT) {
  console.log(formatTable(table, indent));
}

export { INDENT };
