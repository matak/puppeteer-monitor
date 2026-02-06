/**
 * Shared app intro – shown once at startup for all modes.
 * Title, logo-style branding, what it is, why, what follows, repo.
 */

import { C } from './utils/colors.mjs';
import { printCliCommandsTable } from './templates/cli-commands.mjs';

const TITLE = 'Puppeteer Monitor';
const TAGLINE = 'Browser console, network & DOM capture for debugging and LLM workflows';
const REPO_URL = 'https://git.romanmatena.cz/x24gate/puppeteer-monitor';

export function printAppIntro() {
  console.log('');
  console.log(`${C.bold}${C.brightCyan}  ═══════════════════════════════════════════════════════════════════════════  ${C.reset}`);
  console.log(`${C.bold}${C.brightCyan}                                                                              ${C.reset}`);
  console.log(`${C.bold}${C.brightCyan}    ${C.white}${TITLE}${C.reset}${C.bold}${C.brightCyan}                                                                    ${C.reset}`);
  console.log(`${C.bold}${C.brightCyan}    ${C.dim}${REPO_URL}${C.reset}${C.bold}${C.brightCyan}${' '.repeat(26)}${C.reset}`);
  console.log(`${C.bold}${C.brightCyan}                                                                              ${C.reset}`);
  console.log(`${C.bold}${C.brightCyan}  ═══════════════════════════════════════════════════════════════════════════  ${C.reset}`);
  console.log('');
  console.log(`  ${C.dim}${TAGLINE}${C.reset}`);
  console.log('');
  console.log(`  ${C.cyan}What it is${C.reset}   Connects to Chrome and records console output, network requests,`);
  console.log(`  ${C.dim}             cookies, and the current page HTML. Logs go to files (on demand or live).${C.reset}`);
  console.log('');
  console.log(`  ${C.cyan}Why use it${C.reset}   Debug frontend apps without copy-paste. LLM agents can trigger a dump`);
  console.log(`  ${C.dim}             and read the files to get the live DOM and traffic.${C.reset}`);
  console.log('');
  console.log(`  ${C.cyan}What’s next${C.reset}   Choose a mode: ${C.green}interactive${C.reset} (menu), ${C.green}open${C.reset} (launch Chrome), or`);
  console.log(`  ${C.dim}             ${C.green}join${C.reset} (attach to existing). Then use the browser; dump to write logs.${C.reset}`);
  console.log('');
  printCliCommandsTable({ showEntry: true, showUsage: true });
}
