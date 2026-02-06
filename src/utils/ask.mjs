/**
 * CLI prompt helpers (yes/no, port, etc.).
 */

import readline from 'readline';
import { C } from './colors.mjs';

/**
 * Ask user a yes/no question.
 * @param {string} prompt
 * @returns {Promise<boolean>} true for y/yes, false otherwise
 */
export function askYesNo(prompt) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(`${prompt} [y/N]: `, (answer) => {
      rl.close();
      const normalized = (answer || '').trim().toLowerCase();
      resolve(normalized === 'y' || normalized === 'yes');
    });
  });
}

const DEFAULT_HTTP_PORT = 60001;

/**
 * Ask user for HTTP API port; default 60001.
 * @param {number} [defaultPort=60001]
 * @returns {Promise<number>} port 1–65535
 */
export function askHttpPort(defaultPort = DEFAULT_HTTP_PORT) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(`  ${C.cyan}HTTP API port${C.reset} (${C.green}Enter${C.reset} = ${defaultPort}): `, (answer) => {
      rl.close();
      const trimmed = (answer || '').trim();
      if (trimmed === '') {
        resolve(defaultPort);
        return;
      }
      const num = parseInt(trimmed, 10);
      if (Number.isNaN(num) || num < 1 || num > 65535) {
        resolve(defaultPort);
        return;
      }
      resolve(num);
    });
  });
}
