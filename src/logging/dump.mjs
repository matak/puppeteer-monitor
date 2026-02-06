/**
 * Dump actions: write buffers and page data (cookies, DOM) to files.
 * Used by LogBuffer; can be called with any LogBuffer instance.
 */

import fs from 'fs';
import path from 'path';
import { C, log } from '../utils/colors.mjs';
import { getTimestamp, getFullTimestamp } from './timestamps.mjs';

/** Max size for DOM dump (bytes). Larger output is truncated. */
export const DOM_DUMP_MAX_BYTES = 2 * 1024 * 1024; // 2MB

/**
 * Write all in-memory buffers to files and clear buffers.
 * @param {import('./LogBuffer.mjs').LogBuffer} logBuffer
 * @param {Object} options - { dumpCookies?: () => Promise<void>, dumpDom?: () => Promise<void>, dumpScreenshot?: () => Promise<void> }
 * @returns {Promise<Object>} Stats before dump
 */
export async function dumpBuffersToFiles(logBuffer, options = {}) {
  const { dumpCookies, dumpDom, dumpScreenshot } = options;
  const timestamp = getTimestamp();
  const statsBeforeDump = logBuffer.getStats();

  log.section('Dumping Buffers');

  if (logBuffer.consoleBuffer.length > 0) {
    fs.writeFileSync(logBuffer.CONSOLE_LOG, logBuffer.consoleBuffer.join('\n') + '\n');
    log.success(`${C.brightCyan}${logBuffer.consoleBuffer.length}${C.reset}${C.green} console entries → ${logBuffer.CONSOLE_LOG}${C.reset}`);
  } else {
    fs.writeFileSync(logBuffer.CONSOLE_LOG, '');
    log.dim('Console buffer is empty');
  }

  if (logBuffer.networkBuffer.length > 0) {
    fs.writeFileSync(logBuffer.NETWORK_LOG, logBuffer.networkBuffer.join('\n') + '\n');
    log.success(`${C.brightCyan}${logBuffer.networkBuffer.length}${C.reset}${C.green} network entries → ${logBuffer.NETWORK_LOG}${C.reset}`);
  } else {
    fs.writeFileSync(logBuffer.NETWORK_LOG, '');
  }

  logBuffer.clearNetworkDir();
  if (logBuffer.requestDetails.size > 0) {
    for (const [id, data] of logBuffer.requestDetails) {
      const filePath = path.join(logBuffer.NETWORK_DIR, `${id}.json`);
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    }
    log.success(`${C.brightCyan}${logBuffer.requestDetails.size}${C.reset}${C.green} request details → ${logBuffer.NETWORK_DIR}/${C.reset}`);
  }

  if (dumpCookies) await dumpCookies();
  if (dumpDom) await dumpDom();
  if (dumpScreenshot) await dumpScreenshot();

  log.success(`Dump completed at ${timestamp}`);
  logBuffer.clearAllBuffers();

  return statsBeforeDump;
}

/**
 * Dump cookies from a browser page into logBuffer.COOKIES_DIR.
 * @param {import('./LogBuffer.mjs').LogBuffer} logBuffer
 * @param {import('puppeteer').Page} page
 * @returns {Promise<void>}
 */
export async function dumpCookiesFromPage(logBuffer, page) {
  if (!page) {
    log.dim('No page to dump cookies from');
    return;
  }

  try {
    const client = await page.createCDPSession();
    const { cookies } = await client.send('Network.getAllCookies');
    await client.detach();

    if (cookies.length === 0) {
      log.dim('No cookies found');
      return;
    }

    const cookiesByDomain = new Map();
    for (const c of cookies) {
      const domain = c.domain.replace(/^\./, '');
      if (!cookiesByDomain.has(domain)) cookiesByDomain.set(domain, []);
      cookiesByDomain.get(domain).push(c);
    }

    if (fs.existsSync(logBuffer.COOKIES_DIR)) fs.rmSync(logBuffer.COOKIES_DIR, { recursive: true });
    fs.mkdirSync(logBuffer.COOKIES_DIR, { recursive: true });

    const timestamp = getFullTimestamp();
    for (const [domain, domainCookies] of cookiesByDomain) {
      const safeDomain = domain.replace(/[^a-zA-Z0-9.-]/g, '_');
      const cookieFile = path.join(logBuffer.COOKIES_DIR, `${safeDomain}.json`);
      const cookieData = {
        timestamp,
        domain,
        currentUrl: page.url(),
        count: domainCookies.length,
        cookies: domainCookies.map(c => ({
          name: c.name,
          value: c.value,
          domain: c.domain,
          path: c.path,
          expires: c.expires ? new Date(c.expires * 1000).toISOString() : 'Session',
          httpOnly: c.httpOnly,
          secure: c.secure,
          sameSite: c.sameSite || 'None',
        })),
      };
      fs.writeFileSync(cookieFile, JSON.stringify(cookieData, null, 2));
    }

    log.success(`${C.brightCyan}${cookies.length}${C.reset}${C.green} cookies (${cookiesByDomain.size} domains) → ${logBuffer.COOKIES_DIR}/${C.reset}`);
  } catch (e) {
    log.error(`Error dumping cookies: ${e.message}`);
  }
}

/**
 * Dump current document HTML (JS-modified DOM) to logBuffer.DOM_HTML.
 * @param {import('./LogBuffer.mjs').LogBuffer} logBuffer
 * @param {import('puppeteer').Page} page
 * @returns {Promise<void>}
 */
export async function dumpDomFromPage(logBuffer, page) {
  if (!page) {
    log.dim('No page to dump DOM from');
    return;
  }

  try {
    const html = await page.evaluate(() => document.documentElement.outerHTML);
    const maxBytes = DOM_DUMP_MAX_BYTES;
    let content = html;
    const byteLength = Buffer.byteLength(html, 'utf8');
    if (byteLength > maxBytes) {
      content = content.slice(0, Math.floor(maxBytes / 2)) + '\n\n<!-- ... TRUNCATED for size ... -->\n';
      log.dim(`DOM truncated to ~${Math.round(maxBytes / 1024)}KB (was ${Math.round(byteLength / 1024)}KB)`);
    }
    fs.writeFileSync(logBuffer.DOM_HTML, content, 'utf8');
    log.success(`${C.green}DOM (current HTML) → ${logBuffer.DOM_HTML}${C.reset}`);
    log.dim(`LLM: current page HTML / element structure is in: ${logBuffer.DOM_HTML}`);
  } catch (e) {
    log.error(`Error dumping DOM: ${e.message}`);
  }
}

/**
 * Capture screenshot of the current page viewport.
 * @param {import('./LogBuffer.mjs').LogBuffer} logBuffer
 * @param {import('puppeteer').Page} page
 * @returns {Promise<void>}
 */
export async function dumpScreenshotFromPage(logBuffer, page) {
  if (!page) {
    log.dim('No page to capture screenshot from');
    return;
  }

  try {
    await page.screenshot({ path: logBuffer.SCREENSHOT, type: 'png' });
    log.success(`${C.green}Screenshot → ${logBuffer.SCREENSHOT}${C.reset}`);
  } catch (e) {
    log.error(`Error capturing screenshot: ${e.message}`);
  }
}

/**
 * Get computed CSS styles for the first element matching a selector.
 * Uses window.getComputedStyle in the page context (via page.evaluate).
 *
 * @param {import('puppeteer').Page} page
 * @param {string} selector - CSS selector (e.g. 'body', '.my-class', '#id')
 * @returns {Promise<{ selector: string, tagName: string, computed: Record<string, string> } | { error: string }>}
 */
export async function getComputedStylesFromPage(page, selector) {
  if (!page) {
    return { error: 'No page' };
  }

  try {
    const result = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) {
        return { error: `No element matching selector: ${sel}` };
      }
      const cs = window.getComputedStyle(el);
      const computed = {};
      for (let i = 0; i < cs.length; i++) {
        const prop = cs[i];
        computed[prop] = cs.getPropertyValue(prop);
      }
      return {
        selector: sel,
        tagName: el.tagName.toLowerCase(),
        computed,
      };
    }, selector);

    return result;
  } catch (e) {
    return { error: e.message };
  }
}
