/**
 * Help display factories: periodic help reminder + full in-session help.
 */

import { C } from '../../utils/colors.mjs';
import { printReadyHelp } from '../../templates/ready-help.mjs';
import { printApiHelpTable } from '../../templates/api-help.mjs';

/**
 * Create help display functions bound to session state.
 * @param {Object} deps
 * @param {number} deps.httpPort
 * @param {string} deps.keysVariant - KEYS_OPEN or KEYS_JOIN constant
 * @param {Object} deps.logBuffer
 * @param {string} deps.outputDir
 * @param {string} deps.modeLabel - 'Launch mode' or 'Join mode'
 * @param {() => string} deps.getCurrentUrl
 * @param {() => string|null} deps.getProfilePath
 * @param {() => string|null} deps.getBrowserUrl - join shows browserURL, open null
 * @returns {{ maybeShowHelp: () => void, printHelp: () => void }}
 */
export function createHelpHandlers({
  httpPort, keysVariant, logBuffer, outputDir,
  modeLabel, getCurrentUrl, getProfilePath, getBrowserUrl,
}) {
  let outputCounter = 0;
  const HELP_INTERVAL = 5;

  function maybeShowHelp() {
    outputCounter++;
    if (outputCounter % HELP_INTERVAL === 0) {
      printReadyHelp(httpPort, keysVariant);
    }
  }

  function printHelp() {
    const currentUrl = getCurrentUrl();
    const browserUrl = getBrowserUrl();
    const connInfo = browserUrl
      ? `Browser: ${C.brightGreen}${browserUrl}${C.reset}  │  Dir: ${outputDir}`
      : `URL: ${C.brightGreen}${currentUrl}${C.reset}  │  Dir: ${outputDir}`;
    console.log(`${C.cyan}${modeLabel}${C.reset}  ${connInfo}`);
    printApiHelpTable({
      port: httpPort,
      showApi: true,
      showInteractive: true,
      showOutputFiles: true,
      context: {
        consoleLog: logBuffer.CONSOLE_LOG,
        networkLog: logBuffer.NETWORK_LOG,
        networkDir: logBuffer.NETWORK_DIR,
        cookiesDir: logBuffer.COOKIES_DIR,
        domHtml: logBuffer.DOM_HTML,
        screenshot: logBuffer.SCREENSHOT,
      },
      sessionContext: {
        currentUrl: currentUrl || undefined,
        profilePath: getProfilePath(),
      },
    });
  }

  return { maybeShowHelp, printHelp };
}
