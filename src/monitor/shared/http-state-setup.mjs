/**
 * Wire sharedHttpState callbacks to mode-local state.
 */

import { filterUserPages } from './user-page-filter.mjs';

/**
 * @param {Object} sharedHttpState - mutable state object from CLI
 * @param {Object} deps
 * @param {string} deps.mode - 'launch' | 'join'
 * @param {Object} deps.logBuffer
 * @param {() => import('puppeteer').Page[]} deps.getMonitoredPages
 * @param {() => boolean} deps.getCollectingPaused
 * @param {(v: boolean) => void} deps.setCollectingPaused
 * @param {() => import('puppeteer').Browser|null} deps.getBrowser
 * @param {(page: import('puppeteer').Page, label?: string) => void} deps.setupPageMonitoring
 * @param {(page: import('puppeteer').Page) => void} deps.onTabSwitched - mode-specific side effect
 */
export function wireHttpState(sharedHttpState, {
  mode, logBuffer, getMonitoredPages, getCollectingPaused, setCollectingPaused,
  getBrowser, setupPageMonitoring, onTabSwitched,
}) {
  sharedHttpState.mode = mode;
  sharedHttpState.logBuffer = logBuffer;
  sharedHttpState.getPages = getMonitoredPages;
  sharedHttpState.getCollectingPaused = getCollectingPaused;
  sharedHttpState.setCollectingPaused = setCollectingPaused;

  sharedHttpState.getAllTabs = async () => {
    const browser = getBrowser();
    if (!browser) return [];
    const allPages = await browser.pages();
    return filterUserPages(allPages).map((p, i) => ({ index: i + 1, url: p.url() }));
  };

  sharedHttpState.switchToTab = async (index) => {
    const browser = getBrowser();
    if (!browser) return { success: false, error: 'Browser not connected' };
    try {
      const allPages = await browser.pages();
      const pages = filterUserPages(allPages);
      if (index < 1 || index > pages.length) {
        return { success: false, error: `Invalid index. Use 1-${pages.length}.` };
      }
      const selectedPage = pages[index - 1];
      onTabSwitched(selectedPage);
      setupPageMonitoring(selectedPage);
      logBuffer.printConsoleSeparator('TAB SWITCHED');
      logBuffer.printNetworkSeparator('TAB SWITCHED');
      return { success: true, url: selectedPage.url() };
    } catch (e) {
      return { success: false, error: e.message };
    }
  };
}
