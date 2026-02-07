/**
 * Cleanup function and signal handler installation.
 */

import { log } from '../../utils/colors.mjs';

/**
 * Create cleanup function and install signal/error handlers.
 * @param {Object} deps
 * @param {() => import('puppeteer').Browser|null} deps.getBrowser
 * @param {() => import('http').Server|null} deps.getHttpServer
 * @param {(browser: import('puppeteer').Browser, closeBrowser: boolean) => Promise<void>} deps.closeBrowserFn
 * @param {() => void} [deps.afterCleanup] - e.g. PID file removal
 * @param {number} [deps.hardTimeout=0]
 * @returns {{ cleanup: (code?: number, closeBrowser?: boolean) => Promise<void> }}
 */
export function createCleanup({ getBrowser, getHttpServer, closeBrowserFn, afterCleanup, hardTimeout = 0 }) {
  let cleanupDone = false;

  async function cleanup(code = 0, closeBrowser = false) {
    if (cleanupDone) return;
    cleanupDone = true;

    console.log('');
    log.info(closeBrowser ? 'Cleaning up and closing Chrome...' : 'Cleaning up...');

    try {
      const httpServer = getHttpServer();
      if (httpServer) {
        await new Promise((resolve) => httpServer.close(resolve));
        log.dim('HTTP server closed');
      }
    } catch (e) {
      log.error(`Error closing HTTP server: ${e.message}`);
    }

    try {
      const browser = getBrowser();
      if (browser) {
        await closeBrowserFn(browser, closeBrowser);
      }
    } catch (e) {
      log.error(`Error closing browser: ${e.message}`);
    }

    if (afterCleanup) {
      try { afterCleanup(); } catch {}
    }

    process.exit(code);
  }

  // Signal handlers
  process.on('SIGINT', () => {
    console.log('');
    log.dim('Received SIGINT (Ctrl+C)');
    cleanup(0, false);
  });

  process.on('SIGTERM', () => {
    console.log('');
    log.dim('Received SIGTERM');
    cleanup(0, false);
  });

  process.on('uncaughtException', (e) => {
    const msg = (e && e.message) || String(e);
    if (/Execution context was destroyed|Target closed|Protocol error/.test(msg)) {
      log.dim(`Navigation/context closed: ${msg.slice(0, 60)}… (continuing)`);
      return;
    }
    log.error(`Uncaught exception: ${e.message}`);
    console.error(e.stack);
    cleanup(1);
  });

  process.on('unhandledRejection', (e) => {
    const msg = (e && e.message) || String(e);
    if (/Execution context was destroyed|Target closed|Protocol error/.test(msg)) {
      log.dim(`Navigation/context closed: ${msg.slice(0, 60)}… (continuing)`);
      return;
    }
    log.error(`Unhandled rejection: ${e}`);
    cleanup(1);
  });

  // Hard timeout
  if (hardTimeout > 0) {
    setTimeout(() => {
      log.error(`HARD TIMEOUT (${hardTimeout}ms) - forcing exit`);
      cleanup(1);
    }, hardTimeout);
  }

  return { cleanup };
}
