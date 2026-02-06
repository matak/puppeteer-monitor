/**
 * Shared page monitoring: console, network (request/response) listeners.
 * Used by both connect-mode and launch-mode.
 */

import { getTimestamp, getFullTimestamp } from '../logging/index.mjs';

/** Non-fatal: navigation destroyed the context; we skip logging instead of crashing. */
function isContextDestroyedError(e) {
  const msg = (e && e.message) || String(e);
  return /Execution context was destroyed|Target closed|Protocol error/.test(msg);
}

/**
 * Attach console and network monitoring to a page.
 * @param {import('puppeteer').Page} targetPage
 * @param {Object} context
 * @param {import('../logging.mjs').LogBuffer} context.logBuffer
 * @param {() => boolean} context.getCollectingPaused
 * @param {(fn: () => void) => void} context.setActivePageCleanup - setter for cleanup callback
 * @param {string} [context.pageLabel] - optional label for multi-tab (e.g. "[tab 2] ")
 */
export function setupPageMonitoring(targetPage, context) {
  const { logBuffer, getCollectingPaused, setActivePageCleanup, pageLabel = '' } = context;

  const requestData = new Map();

  const onConsole = async (msg) => {
    try {
      if (getCollectingPaused()) return;
      const type = msg.type();
      const timestamp = getTimestamp();

      if (type === 'clear') {
        logBuffer.clearConsoleBuffer();
        logBuffer.printConsoleSeparator(pageLabel ? 'CONSOLE CLEARED' : 'CONSOLE CLEARED - Output reset');
        return;
      }

      let text;
      try {
        const args = msg.args();
        const serialized = await Promise.all(
          args.map(async (arg) => {
            try {
              const val = await arg.jsonValue();
              if (typeof val === 'object' && val !== null) return JSON.stringify(val);
              return String(val);
            } catch {
              return arg.toString();
            }
          })
        );
        text = serialized.join(' ');
      } catch {
        text = msg.text();
      }

      if (logBuffer.shouldIgnore(text)) return;
      if (logBuffer.isHmr(text)) {
        logBuffer.printConsoleSeparator('HMR UPDATE - Code change detected');
      }
      const typeStr = type.toUpperCase().padEnd(7);
      logBuffer.logConsole(`[${timestamp}] ${pageLabel}${typeStr} ${text}`);
    } catch (e) {
      if (isContextDestroyedError(e)) return;
      throw e;
    }
  };

  const onPageError = (error) => {
    try {
      if (getCollectingPaused()) return;
      logBuffer.logConsole(`[${getTimestamp()}] ${pageLabel}[PAGE ERROR] ${error.message}`);
    } catch (e) {
      if (isContextDestroyedError(e)) return;
      throw e;
    }
  };

  const onRequest = (request) => {
    try {
      if (getCollectingPaused()) return;
      const reqUrl = request.url();
      const method = request.method();
      const resourceType = request.resourceType();
      const timestamp = getFullTimestamp();
      const id = logBuffer.nextRequestId();
      let postData = null;
      try {
        postData = request.postData();
      } catch (e) {}
      requestData.set(request, { id, startTime: Date.now(), method, resourceType });
      logBuffer.saveRequestDetail(id, {
        id, timestamp, method, resourceType, url: reqUrl,
        request: { headers: request.headers(), postData },
      });
      logBuffer.logNetwork(`[${timestamp}] --> ${id} ${method} ${resourceType.toUpperCase().padEnd(10)} ${reqUrl}`);
    } catch (e) {
      if (isContextDestroyedError(e)) return;
      throw e;
    }
  };

  const onResponse = async (response) => {
    try {
      if (getCollectingPaused()) return;
      const respUrl = response.url();
      const status = response.status();
      const timestamp = getFullTimestamp();
      const req = response.request();
      const data = req ? requestData.get(req) : null;
      let duration = '';
      let id = '?????';
      if (data) {
        const ms = Date.now() - data.startTime;
        duration = ` (${ms}ms)`;
        id = data.id;
        requestData.delete(req);
        const responseHeaders = response.headers();
        let responseBody = null;
        const contentType = responseHeaders['content-type'] || '';
        const isTextBased =
          contentType.includes('json') || contentType.includes('text') ||
          contentType.includes('javascript') || contentType.includes('xml');
        if (isTextBased) {
          try {
            responseBody = await response.text();
            if (responseBody.length > 100000) {
              responseBody = responseBody.substring(0, 100000) + '\n... [TRUNCATED]';
            }
          } catch (e) {
            responseBody = `[Error reading body: ${e.message}]`;
          }
        } else {
          responseBody = `[Binary content: ${contentType}]`;
        }
        logBuffer.updateRequestDetail(id, {
          response: {
            status,
            statusText: response.statusText(),
            headers: responseHeaders,
            body: responseBody,
            duration: ms,
          },
        });
      }
      logBuffer.logNetwork(`[${timestamp}] <-- ${id} ${status.toString().padStart(3)} ${respUrl}${duration}`);
    } catch (e) {
      if (isContextDestroyedError(e)) return;
      throw e;
    }
  };

  const onRequestFailed = (request) => {
    try {
      if (getCollectingPaused()) return;
      const reqUrl = request.url();
      const timestamp = getFullTimestamp();
      const failure = request.failure();
      const data = requestData.get(request);
      let duration = '';
      let id = '?????';
      if (data) {
        const ms = Date.now() - data.startTime;
        duration = ` (${ms}ms)`;
        id = data.id;
        requestData.delete(request);
        logBuffer.updateRequestDetail(id, { failed: { errorText: failure?.errorText, duration: ms } });
      }
      logBuffer.logNetwork(`[${timestamp}] [FAILED] ${id} ${reqUrl}: ${failure?.errorText}${duration}`);
      if (!reqUrl.includes('oauth2/sign_in')) {
        logBuffer.logConsole(`[${getTimestamp()}] [FAILED] ${reqUrl}: ${failure?.errorText}`);
      }
    } catch (e) {
      if (isContextDestroyedError(e)) return;
      throw e;
    }
  };

  targetPage.on('console', onConsole);
  targetPage.on('pageerror', onPageError);
  targetPage.on('request', onRequest);
  targetPage.on('response', onResponse);
  targetPage.on('requestfailed', onRequestFailed);

  const removeListeners = (p) => {
    if (typeof p?.removeListener !== 'function') return;
    p.removeListener('console', onConsole);
    p.removeListener('pageerror', onPageError);
    p.removeListener('request', onRequest);
    p.removeListener('response', onResponse);
    p.removeListener('requestfailed', onRequestFailed);
  };
  setActivePageCleanup(() => {
    removeListeners(targetPage);
    requestData.clear();
  });
}
