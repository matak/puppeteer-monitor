/**
 * CLI prompt helpers.
 * All prompts use stdin.once('data') to keep stdin open for keypress listeners.
 */

import readline from 'readline';
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
async function askDefaultUrl(defaultValue = 'https://localhost:4000/') {
  const answer = await readLine(`  ${C.cyan}Default URL${C.reset} [${C.dim}${defaultValue}${C.reset}]: `);
  return answer || defaultValue;
}

/**
 * Return currentValue if set, otherwise ask the user for default URL.
 * @param {string|null|undefined} currentValue - From CLI args or config
 * @param {string} [defaultUrl='about:blank']
 * @returns {Promise<string>}
 */
export async function resolveDefaultUrl(currentValue, defaultUrl = 'about:blank') {
  if (currentValue != null) return currentValue;
  return askDefaultUrl(defaultUrl);
}

/**
 * Ask user for HTTP API port.
 * @param {number} [defaultPort=60001]
 * @returns {Promise<number>}
 */
async function askHttpPort(defaultPort = 60001) {
  const answer = await readLine(`  ${C.cyan}HTTP API port${C.reset} [${C.dim}${defaultPort}${C.reset}]: `);
  if (!answer) return defaultPort;
  const num = parseInt(answer, 10);
  return !Number.isNaN(num) && num >= 1 && num <= 65535 ? num : defaultPort;
}

/**
 * Return currentValue if set, otherwise ask the user for HTTP port.
 * @param {number|null|undefined} currentValue - From CLI args or config
 * @param {number} [defaultPort=60001]
 * @returns {Promise<number>}
 */
export async function resolveHttpPort(currentValue, defaultPort = 60001) {
  if (currentValue != null) return currentValue;
  return askHttpPort(defaultPort);
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

/**
 * Ask user to choose action: open, join, or quit.
 * Single keypress – no Enter needed.
 * @returns {Promise<'o'|'j'|'q'>}
 */
export function askMode() {
  console.log('');
  console.log(`    ${C.green}o${C.reset} = open Chrome`);
  console.log(`    ${C.green}j${C.reset} = join running Chrome`);
  console.log(`    ${C.green}q${C.reset} = quit`);
  console.log('');
  process.stdout.write(`  ${C.cyan}Action${C.reset} [o/j/q]: `);

  readline.emitKeypressEvents(process.stdin);
  if (process.stdin.isTTY && !process.stdin.isRaw) {
    process.stdin.setRawMode(true);
  }
  process.stdin.resume();

  return new Promise((resolve) => {
    const handleKey = (str, key) => {
      if (!key) return;
      const char = (key.name || str || '').toLowerCase();
      if (char === 'o' || char === 'j' || char === 'q') {
        process.stdin.removeListener('keypress', handleKey);
        process.stdout.write(char + '\n');
        resolve(char);
      }
    };
    process.stdin.on('keypress', handleKey);
  });
}
