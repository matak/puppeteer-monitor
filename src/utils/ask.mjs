/**
 * CLI prompt helpers.
 * All prompts use stdin.once('data') to keep stdin open for keypress listeners.
 */

import { C } from './colors.mjs';

/**
 * Read one line from stdin without closing it.
 * Handles raw mode save/restore for interactive mode compatibility.
 */
function readLine(prompt) {
  return new Promise((resolve) => {
    const wasRaw = process.stdin.isTTY && process.stdin.isRaw;
    if (wasRaw) process.stdin.setRawMode(false);

    process.stdout.write(prompt);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    process.stdin.once('data', (chunk) => {
      process.stdin.pause();
      if (wasRaw && process.stdin.isTTY) process.stdin.setRawMode(true);
      resolve(chunk.toString().trim().split('\n')[0].trim());
    });
  });
}

/**
 * Ask user for default URL.
 * @param {string} [defaultValue='https://localhost:4000/']
 * @returns {Promise<string>}
 */
export async function askDefaultUrl(defaultValue = 'https://localhost:4000/') {
  const answer = await readLine(`  ${C.cyan}Default URL${C.reset} [${C.dim}${defaultValue}${C.reset}]: `);
  return answer || defaultValue;
}

/**
 * Ask user for HTTP API port.
 * @param {number} [defaultPort=60001]
 * @returns {Promise<number>}
 */
export async function askHttpPort(defaultPort = 60001) {
  const answer = await readLine(`  ${C.cyan}HTTP API port${C.reset} [${C.dim}${defaultPort}${C.reset}]: `);
  if (!answer) return defaultPort;
  const num = parseInt(answer, 10);
  return !Number.isNaN(num) && num >= 1 && num <= 65535 ? num : defaultPort;
}

/**
 * Ask user a yes/no question.
 * @param {string} prompt
 * @returns {Promise<boolean>}
 */
export async function askYesNo(prompt) {
  const answer = await readLine(`${prompt} [y/N]: `);
  const normalized = answer.toLowerCase();
  return normalized === 'y' || normalized === 'yes';
}
