/**
 * Tab selection UI: let user pick one page from a list (for connect/launch mode).
 */

import readline from 'readline';
import { C, log } from '../utils/colors.mjs';

export function ensureKeypressEvents() {
  readline.emitKeypressEvents(process.stdin);
  if (process.stdin.isTTY && !process.stdin.isRaw) {
    process.stdin.setRawMode(true);
  }
}

/**
 * @param {import('puppeteer').Page[]} pages
 * @returns {Promise<import('puppeteer').Page|null>}
 */
export function askUserToSelectPage(pages) {
  ensureKeypressEvents();
  console.log('');
  pages.forEach((p, index) => {
    const pageUrl = p.url();
    const num = (index + 1).toString();
    const displayUrl = pageUrl.length > 70 ? pageUrl.substring(0, 67) + '...' : pageUrl;
    console.log(`  ${C.brightGreen}${num}${C.reset}. ${C.cyan}${displayUrl}${C.reset}`);
  });
  console.log('');
  console.log(`  ${C.red}q${C.reset}. Cancel`);
  console.log('');

  return new Promise((resolve) => {
    process.stdout.write(`${C.cyan}Select tab${C.reset} (${C.green}1-${pages.length}${C.reset}, ${C.red}q${C.reset}=cancel): `);
    const handleKey = (str, key) => {
      if (!key) return;
      process.stdin.removeListener('keypress', handleKey);
      const char = key.name || str;
      process.stdout.write(char + '\n');
      if (char === 'q') {
        resolve(null);
      } else {
        const num = parseInt(char, 10);
        if (num >= 1 && num <= pages.length) {
          resolve(pages[num - 1]);
        } else {
          log.warn('Invalid selection');
          resolve(null);
        }
      }
    };
    process.stdin.once('keypress', handleKey);
  });
}
