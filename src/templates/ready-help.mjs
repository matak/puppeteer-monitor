/**
 * Shared "Ready" help block – printed once when monitoring starts and repeated
 * every HELP_INTERVAL (e.g. 5) lines of status/output. Used by open-mode and join-mode.
 */

import { C } from '../utils/colors.mjs';
import { createTable, printTable } from './table-helper.mjs';

/** Keys line suffix: open = k+q with Chrome stays, join = k+q disconnect */
export const KEYS_OPEN = `${C.green}k${C.reset}=close Chrome+quit ${C.green}q${C.reset}=quit (Chrome stays)`;
export const KEYS_JOIN = `${C.green}k${C.reset}=kill ${C.green}q${C.reset}=quit`;

/**
 * Print the Ready block (single-cell table).
 */
export function printReadyHelp(httpPort, keysSuffix) {
  const content = `${C.green}Ready${C.reset} │ ${C.green}d${C.reset}=dump ${C.green}c${C.reset}=clear ${C.green}s${C.reset}=status ${C.green}p${C.reset}=stop/start ${C.green}t${C.reset}=tab ${C.green}h${C.reset}=help │ ${keysSuffix}  ${C.dim}│ full table: h${C.reset}`;
  const table = createTable({ colWidths: [95] });
  table.push([content]);
  printTable(table);
}

/**
 * Print status block (s key) – URL first, then status line. Single-cell table.
 */
export function printStatusBlock(stats, urlLine, tabCount, collectingPaused) {
  const urlDisplay = `${C.dim}URL:${C.reset} ${C.cyan}${urlLine}${C.reset}`;
  const statusDisplay = `${C.cyan}[Status]${C.reset} ${C.brightCyan}${stats.consoleEntries}${C.reset} console │ ${C.brightCyan}${stats.networkEntries}${C.reset} network │ ${C.brightCyan}${stats.requestDetails}${C.reset} requests │ ${C.brightGreen}${tabCount}${C.reset} tab(s) │ collecting: ${collectingPaused ? C.yellow + 'paused' : C.green + 'running'}${C.reset}`;
  const content = `${urlDisplay}\n${statusDisplay}`;
  const table = createTable({ colWidths: [95] });
  table.push([content]);
  printTable(table);
}
