/**
 * Interactive keyboard input handler (raw mode stdin).
 * Shared between open-mode and join-mode.
 */

import readline from 'readline';
import { log } from '../../utils/colors.mjs';
import { printStatusBlock } from '../../templates/ready-help.mjs';

/**
 * Setup keyboard input for lazy (buffered) mode.
 * @param {Object} deps
 * @param {() => import('puppeteer').Page|null} deps.getActivePage
 * @param {Object} deps.logBuffer
 * @param {(code?: number, closeBrowser?: boolean) => Promise<void>} deps.cleanup
 * @param {() => Promise<void>} deps.switchTabs
 * @param {() => void} deps.printHelp
 * @param {() => void} deps.maybeShowHelp
 * @param {() => boolean} deps.isSelectingTab
 * @param {() => boolean} deps.getCollectingPaused
 * @param {(v: boolean) => void} deps.setCollectingPaused
 * @param {() => Promise<{ currentUrl: string, tabCount: number }>} deps.getStatusInfo
 */
export function setupKeyboardInput({
  getActivePage, logBuffer, cleanup, switchTabs,
  printHelp, maybeShowHelp, isSelectingTab,
  getCollectingPaused, setCollectingPaused, getStatusInfo,
}) {
  readline.emitKeypressEvents(process.stdin);
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }

  process.stdin.on('keypress', async (str, key) => {
    if (key.ctrl && key.name === 'c') {
      cleanup(0);
      return;
    }

    // Ignore keys during tab selection
    if (isSelectingTab()) return;

    // Shortcuts only without modifiers
    if (key.ctrl || key.shift || key.meta) return;

    if (key.name === 'd') {
      const page = getActivePage();
      await logBuffer.dumpBuffersToFiles({
        dumpCookies: page ? () => logBuffer.dumpCookiesFromPage(page) : null,
        dumpDom: page ? () => logBuffer.dumpDomFromPage(page) : null,
        dumpScreenshot: page ? () => logBuffer.dumpScreenshotFromPage(page) : null,
      });
      maybeShowHelp();
    } else if (key.name === 'c') {
      logBuffer.clearAllBuffers();
      maybeShowHelp();
    } else if (key.name === 'q') {
      cleanup(0, false);
    } else if (key.name === 'k') {
      log.warn('Closing Chrome and exiting...');
      cleanup(0, true);
    } else if (key.name === 's') {
      const { currentUrl, tabCount } = await getStatusInfo();
      const stats = logBuffer.getStats();
      printStatusBlock(stats, currentUrl, tabCount, getCollectingPaused());
      maybeShowHelp();
    } else if (key.name === 'p') {
      const paused = !getCollectingPaused();
      setCollectingPaused(paused);
      log.info(paused ? 'Collecting stopped (paused). Press p or curl .../start to resume.' : 'Collecting started (resumed).');
      maybeShowHelp();
    } else if (key.name === 't') {
      await switchTabs();
      maybeShowHelp();
    } else if (key.name === 'h') {
      printHelp();
    }
  });
}
