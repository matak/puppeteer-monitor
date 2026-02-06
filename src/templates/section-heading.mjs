/**
 * Shared section heading – box-style title (HTTP API, CLI, Interactive).
 * All boxes use boxen for correct border alignment.
 */

import boxen from 'boxen';
import { C } from '../utils/colors.mjs';
import { createTable, printTable } from './table-helper.mjs';

/** Shared boxen options – single border, dim gray, no padding, left margin for alignment with other blocks. */
export const BOXEN_OPTS = {
  borderStyle: 'single',
  padding: { top: 0, right: 0, bottom: 0, left: 0 },
  margin: { top: 0, right: 0, bottom: 0, left: 2 },
  borderColor: 'gray',
  dimBorder: true,
};

/**
 * Wrap content in boxen and return indented string.
 * @param {string} content - Text (may contain ANSI)
 * @param {string} [indent='']
 */
export function renderBox(content, indent = '') {
  const box = boxen(content, BOXEN_OPTS);
  return box.split('\n').map((l) => indent + l).join('\n');
}

/** Strip ANSI escape codes for display length calculation. */
function stripAnsi(s) {
  return String(s).replace(/\x1b\[[0-9;]*m/g, '');
}

/**
 * Print a section heading in a small box.
 * @param {string} title - e.g. "HTTP API", "CLI", "Interactive", or "HTTP API URL: http://..."
 * @param {string} [indent='']
 */
export function printSectionHeading(title, indent = '') {
  const content = ` ${C.bold}${C.cyan}${title}${C.reset} `;
  console.log(renderBox(content, indent));
}

/**
 * Wrap text to max width; returns array of lines.
 * Works on plain text (ANSI stripped) – use for paths/messages that have no/simple colors.
 */
function wrapPlainText(text, maxLen) {
  const plain = stripAnsi(text);
  if (plain.length <= maxLen) return [text];
  const lines = [];
  let remaining = plain;
  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      lines.push(remaining);
      break;
    }
    let breakAt = maxLen;
    const chunk = remaining.slice(0, maxLen);
    const lastSpace = chunk.lastIndexOf(' ');
    if (lastSpace > maxLen * 0.5) breakAt = lastSpace + 1;
    lines.push(remaining.slice(0, breakAt));
    remaining = remaining.slice(breakAt).replace(/^\s+/, '');
  }
  return lines;
}

/**
 * Print a bullet box – info lines (UNC/CMD, Profile path) as a single-cell table.
 * Long lines wrap to stay within BULLET_BOX_MAX_WIDTH.
 * @param {string[]} lines - Raw lines (no bullets; we add • )
 * @param {string} [indent='  ']
 */
const MAX_LINE_WIDTH = 71; // wrap long lines at this (prefix excluded)

export function printBulletBox(lines, indent = '  ') {
  if (lines.length === 0) return;
  const bullet = ' • ';
  const contentWidth = MAX_LINE_WIDTH;
  const contentLines = [];
  for (const line of lines) {
    const plain = stripAnsi(line);
    const wrapped = plain.length <= contentWidth ? [line] : wrapPlainText(plain, contentWidth);
    for (let i = 0; i < wrapped.length; i++) {
      const prefix = i === 0 ? `${C.cyan}${bullet}${C.reset}` : '   ';
      const chunk = wrapped[i];
      const display = i === 0 && wrapped.length === 1 ? line : chunk;
      contentLines.push(`${prefix}${display}`);
    }
  }
  const content = contentLines.join('\n');
  const table = createTable({
    colWidths: [74],
    tableOpts: { wordWrap: true, maxWidth: 80 },
  });
  table.push([content]);
  printTable(table, indent);
}

/**
 * Print mode heading – Open mode / Join mode with blue background.
 * Call as soon as mode is chosen (o or j), before any connection logic.
 * @param {'Open mode' | 'Join mode'} mode
 * @param {string} [indent='  ']
 */
export function printModeHeading(mode, indent = '  ') {
  const titleLine = `  ${mode}  `;
  const content = `${C.bgCyan}${C.bold}${C.white}${titleLine}${C.reset}`;
  console.log('');
  console.log(renderBox(content, indent));
}

/**
 * Print Interactive menu block – title with blue background filling full width.
 * Options are printed outside the box by the caller.
 * @param {string} titleLine - e.g. "  Interactive   Chrome not started – choose action"
 * @param {string} [indent='  ']
 */
export function printInteractiveMenuBlock(titleLine, indent = '  ') {
  const content = `${C.bgCyan}${C.bold}${C.white}${titleLine}${C.reset}`;
  console.log(renderBox(content, indent));
}

/**
 * Print Join connected block – WSL title (blue bg) + monitored URL. Shown when join succeeds.
 * Single-cell table.
 * @param {string} windowsHostIp - e.g. "172.29.96.1"
 * @param {string} url - Monitored page URL
 * @param {string} [indent='  ']
 */
export function printJoinConnectedBlock(windowsHostIp, url, indent = '  ') {
  const titleLine = `  WSL detected, using Windows host IP: ${windowsHostIp}`;
  const content = `${C.bgCyan}${C.bold}${C.white}${titleLine}${C.reset}\n ${C.cyan}${url}${C.reset}`;
  console.log('');
  const table = createTable({
    colWidths: [74],
    tableOpts: { wordWrap: true, maxWidth: 80 },
  });
  table.push([content]);
  printTable(table, indent);
}
