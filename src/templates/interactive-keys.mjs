/**
 * Single source of truth for keyboard shortcuts (human interaction).
 * Own section with same box heading as CLI / HTTP API.
 */

import { C } from '../utils/colors.mjs';
import { printSectionHeading } from './section-heading.mjs';
import { createTable, printTable, INDENT } from './table-helper.mjs';

export const KEYBOARD_KEYS = [
  { key: 'd', action: 'dump to files' },
  { key: 'c', action: 'clear buffer' },
  { key: 's', action: 'status' },
  { key: 'p', action: 'pause/resume' },
  { key: 't', action: 'switch tab' },
  { key: 'h', action: 'this help' },
  { key: 'k', action: 'kill / quit' },
  { key: 'q', action: 'quit' },
];

const DESCRIPTION = 'Human interaction: keyboard shortcuts while monitoring.';

export function printInteractiveSection() {
  console.log('');
  printSectionHeading('Interactive', INDENT);
  console.log(`${INDENT}${C.dim}${DESCRIPTION}${C.reset}`);
  console.log('');
  const table = createTable({ colWidths: [6, 22] });
  for (const r of KEYBOARD_KEYS) {
    table.push([`${C.green}${r.key}${C.reset}`, r.action]);
  }
  printTable(table);
}
