/**
 * Factory for page monitoring setup, bound to local session state.
 * Manages listener lifecycle: each call to setupPageMonitoring automatically
 * cleans up listeners from the previously monitored page.
 */

import { setupPageMonitoring as setupPageMonitoringShared } from '../page-monitoring.mjs';

/**
 * Create a setupPageMonitoring function bound to the current session's state.
 * @param {Object} deps
 * @param {Object} deps.logBuffer
 * @param {() => boolean} deps.getCollectingPaused
 * @returns {{ setupPageMonitoring: (page: import('puppeteer').Page, pageLabel?: string) => void, cleanupActivePageListeners: () => void }}
 */
export function createSetupPageMonitoring({ logBuffer, getCollectingPaused }) {
  let activePageCleanup = null;

  function cleanupActivePageListeners() {
    if (activePageCleanup) {
      activePageCleanup();
      activePageCleanup = null;
    }
  }

  function setupPageMonitoring(targetPage, pageLabel = '') {
    // Remove listeners from previous page before attaching to new one
    cleanupActivePageListeners();

    setupPageMonitoringShared(targetPage, {
      logBuffer,
      getCollectingPaused,
      setActivePageCleanup: (fn) => { activePageCleanup = fn; },
      pageLabel,
    });
  }

  return { setupPageMonitoring, cleanupActivePageListeners };
}
