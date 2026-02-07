/**
 * Chrome instance discovery and selection utilities.
 * Used by join mode and interactive mode to find running Chrome instances.
 */

import { C, log } from './colors.mjs';
import { writeStatusLine, clearStatusLine } from './status-line.mjs';
import { isWsl, scanChromeInstances } from '../os/wsl/index.mjs';
import { ensureKeypressEvents } from '../monitor/tab-selection.mjs';

/**
 * Collect Chrome instances with remote debugging.
 * @returns {Promise<Array<{ port: number, label: string }>>}
 */
export async function getChromeInstances() {
  writeStatusLine(`${C.dim}Scanning for Chrome...${C.reset}`);
  try {
    if (isWsl()) {
      const { instances } = scanChromeInstances();
      return instances.map((i) => ({ port: i.port, label: `${i.port} – ${i.profile}` }));
    }
    const list = [];
    const host = '127.0.0.1';
    for (let port = 9222; port <= 9229; port++) {
      try {
        const res = await fetch(`http://${host}:${port}/json/version`, { signal: AbortSignal.timeout(800) });
        if (res.ok) {
          const info = await res.json();
          const label = info.Browser ? `${port} – ${info.Browser}` : String(port);
          list.push({ port, label });
        }
      } catch {
        // Port not reachable
      }
    }
    return list;
  } finally {
    clearStatusLine();
  }
}

/**
 * Let user pick one Chrome instance from list.
 * @param {Array<{ port: number, label: string }>} items
 * @returns {Promise<number|null>}
 */
export function askUserToSelectChromeInstance(items) {
  if (items.length === 0) return Promise.resolve(null);
  if (items.length === 1) {
    return Promise.resolve(items[0].port);
  }
  console.log('');
  items.forEach((item, index) => {
    console.log(`  ${C.brightGreen}${index + 1}${C.reset}. ${C.cyan}${item.label}${C.reset}`);
  });
  console.log('');
  console.log(`  ${C.red}q${C.reset}. Cancel`);
  console.log('');
  ensureKeypressEvents();
  return new Promise((resolve) => {
    process.stdout.write(`${C.cyan}Select Chrome instance${C.reset} (${C.green}1-${items.length}${C.reset}, ${C.red}q${C.reset}=cancel): `);
    const handleKey = (str, key) => {
      if (!key) return;
      process.stdin.removeListener('keypress', handleKey);
      const char = (key.name || str).toLowerCase();
      process.stdout.write(char + '\n');
      if (char === 'q') {
        resolve(null);
      } else {
        const num = parseInt(char, 10);
        if (num >= 1 && num <= items.length) {
          resolve(items[num - 1].port);
        } else {
          log.warn('Invalid selection');
          resolve(null);
        }
      }
    };
    process.stdin.once('keypress', handleKey);
  });
}
