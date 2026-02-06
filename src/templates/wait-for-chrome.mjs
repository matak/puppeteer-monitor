/**
 * Unified "wait for Chrome" block – variable title, common prompt.
 * Used when Chrome is not ready and user must start it or fix config.
 */

import { C } from '../utils/colors.mjs';

/** Common prompt line shown in all wait-for-Chrome scenarios. */
export const WAIT_FOR_CHROME_PROMPT =
  `${C.yellow}[Monitor]${C.reset} Press ${C.bgGreen}${C.white}${C.bold} ENTER ${C.reset} when Chrome is running, or ${C.red}Ctrl+C${C.reset} to cancel...`;

/**
 * Build full content for wait block: title (context) + common prompt.
 * @param {string} [titleContent] - Variable part (e.g. "Chrome found but not accessible...")
 * @returns {string}
 */
export function buildWaitForChromeContent(titleContent) {
  return titleContent ? `${titleContent}\n\n${WAIT_FOR_CHROME_PROMPT}` : WAIT_FOR_CHROME_PROMPT;
}
