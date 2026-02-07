/**
 * Interactive tab switching (t key).
 */

import { C, log } from '../../utils/colors.mjs';
import { askUserToSelectPage } from '../tab-selection.mjs';
import { filterUserPages } from './user-page-filter.mjs';

/**
 * Create interactive tab-switch function.
 * @param {Object} deps
 * @param {() => import('puppeteer').Browser|null} deps.getBrowser
 * @param {(page: import('puppeteer').Page) => void} deps.onTabSwitched
 * @param {(page: import('puppeteer').Page, label?: string) => void} deps.setupPageMonitoring
 * @param {Object} deps.logBuffer
 * @param {(v: boolean) => void} deps.setSelectingTab
 * @returns {() => Promise<void>}
 */
export function createSwitchTabs({ getBrowser, onTabSwitched, setupPageMonitoring, logBuffer, setSelectingTab }) {
  return async () => {
    const browser = getBrowser();
    if (!browser) {
      log.error('Browser not connected');
      return;
    }

    try {
      const allPages = await browser.pages();
      const pages = filterUserPages(allPages);

      if (pages.length === 0) {
        log.warn('No user tabs found');
        return;
      }

      if (pages.length === 1) {
        log.info('Only one user tab available');
        return;
      }

      setSelectingTab(true);
      const selectedPage = await askUserToSelectPage(pages);
      setSelectingTab(false);

      if (selectedPage === null) {
        log.dim('Tab switch cancelled');
        return;
      }

      onTabSwitched(selectedPage);
      setupPageMonitoring(selectedPage);
      log.success(`Now monitoring: ${C.brightCyan}${selectedPage.url()}${C.reset}`);

      logBuffer.printConsoleSeparator('TAB SWITCHED');
      logBuffer.printNetworkSeparator('TAB SWITCHED');
    } catch (e) {
      log.error(`Error switching tabs: ${e.message}`);
      setSelectingTab(false);
    }
  };
}
