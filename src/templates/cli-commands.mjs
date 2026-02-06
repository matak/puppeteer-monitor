/**
 * Single source of truth for CLI commands and usage.
 * Used in intro and in --help so we never duplicate.
 */

import { C } from '../utils/colors.mjs';
import { printSectionHeading } from './section-heading.mjs';
import { createTable, printTable, INDENT } from './table-helper.mjs';

// ─── Data (edit only here) ─────────────────────────────────────────────────

export const ENTRY_POINT = 'puppeteer-monitor  (or: pnpm browsermonitor when wired in package.json scripts)';

export const USAGE = 'puppeteer-monitor [url] [options]';

export const CLI_EXAMPLES = [
  { command: 'puppeteer-monitor', description: 'Interactive menu, then o = open / j = join / q = quit' },
  { command: 'puppeteer-monitor --open', description: 'Launch Chrome and monitor (URL from config or first arg)' },
  { command: 'puppeteer-monitor --open https://localhost:5173/', description: 'Open with URL' },
  { command: 'puppeteer-monitor --join=9222', description: 'Attach to Chrome with remote debugging on port 9222' },
  { command: 'puppeteer-monitor --help', description: 'Show full help (options, API table, examples)' },
];

/**
 * Print CLI commands as a readable table (intro and --help).
 */
export function printCliCommandsTable(options = {}) {
  const { showEntry = true, showUsage = true } = options;

  const table = createTable({
    colWidths: [10, 68],
    tableOpts: { wordWrap: true, maxWidth: 90 },
  });

  if (showEntry) {
    table.push([`${C.dim}Entry${C.reset}`, `${C.green}${ENTRY_POINT}${C.reset}`]);
  }
  if (showUsage) {
    table.push([`${C.dim}Usage${C.reset}`, `${C.brightCyan}${USAGE}${C.reset}`]);
  }
  const examplesContent = CLI_EXAMPLES.map(
    (ex) => `${C.brightCyan}${ex.command}${C.reset}  ${ex.description}`
  ).join('\n');
  table.push([`${C.dim}Examples${C.reset}`, examplesContent]);

  console.log('');
  printSectionHeading('CLI', INDENT);
  printTable(table);
  console.log('');
}
