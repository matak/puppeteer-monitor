/**
 * Join Mode - attach to existing Chrome (connect to running browser).
 */

import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { C, log } from '../utils/colors.mjs';
import { getChromeProfileLocation } from '../utils/chrome-profile-path.mjs';
import {
  isWsl,
  getWindowsHostForWSL,
  detectWindowsChromeCanaryPath,
  printCanaryInstallInstructions,
  scanChromeInstances,
  findProjectChrome,
  findFreeDebugPort,
  startChromeOnWindows,
  killPuppeteerMonitorChromes,
  removePortProxyIfExists,
  isPortBlocked,
  runWslDiagnostics,
} from '../os/wsl/index.mjs';
import { LogBuffer } from '../logging/index.mjs';
import { askUserToSelectPage } from './tab-selection.mjs';
import { askYesNo } from '../utils/ask.mjs';
import { printReadyHelp, KEYS_JOIN } from '../templates/ready-help.mjs';
import { printJoinConnectedBlock, printModeHeading } from '../templates/section-heading.mjs';
import { createTable, printTable } from '../templates/table-helper.mjs';
import { buildWaitForChromeContent } from '../templates/wait-for-chrome.mjs';
import { writeStatusLine, clearStatusLine } from '../utils/status-line.mjs';
import {
  filterUserPages,
  createSetupPageMonitoring,
  createHelpHandlers,
  wireHttpState,
  createSwitchTabs,
  createCleanup,
  setupKeyboardInput,
} from './shared/index.mjs';

/**
 * Run in Join Mode - attach to an existing Chrome browser.
 * If options.joinPort is given, connects to that port directly.
 * If not, scans for running Chrome instances (WSL: process scan, other: probe 9222-9229).
 */
export async function runJoinMode(defaultUrl, options = {}) {
  const {
    joinPort = null,
    realtime = false,
    outputDir,
    paths,
    ignorePatterns = [],
    hardTimeout = 0,
    httpPort,
    host = null,
    sharedHttpState,
    sharedHttpServer,
    skipModeHeading = false,
  } = options;

  if (!skipModeHeading) printModeHeading('Join mode');
  const lazyMode = !realtime;
  const connectHost = host || getWindowsHostForWSL({ quiet: true });
  const browserURL = joinPort ? `http://${connectHost}:${joinPort}` : null;
  // Mutable URL that will be updated if auto-port-selection changes the port
  let currentBrowserURL = browserURL;

  // Create LogBuffer instance for centralized buffer management
  const logBuffer = new LogBuffer({
    outputDir,
    paths,
    lazyMode,
    ignorePatterns,
  });

  let browser = null;
  let monitoredPages = [];
  let httpServer = sharedHttpServer;
  let isSelectingTab = false;
  let collectingPaused = false;

  // ===== SHARED MODULES WIRING =====

  const { setupPageMonitoring, cleanupActivePageListeners } = createSetupPageMonitoring({
    logBuffer,
    getCollectingPaused: () => collectingPaused,
  });

  const { cleanup } = createCleanup({
    getBrowser: () => browser,
    getHttpServer: () => httpServer,
    closeBrowserFn: async (br, closeBrowser) => {
      cleanupActivePageListeners();
      if (closeBrowser) {
        await br.close();
        log.success('Browser closed');
      } else {
        br.disconnect();
        log.success('Disconnected from browser (Chrome still running)');
      }
    },
    hardTimeout,
  });

  const { maybeShowHelp, printHelp } = createHelpHandlers({
    httpPort,
    keysVariant: KEYS_JOIN,
    logBuffer,
    outputDir,
    modeLabel: 'Join mode',
    getCurrentUrl: () => monitoredPages[0]?.url?.() || defaultUrl || '',
    getProfilePath: () => getChromeProfileLocation(outputDir)?.path,
    getBrowserUrl: () => currentBrowserURL,
  });

  wireHttpState(sharedHttpState, {
    mode: 'join',
    logBuffer,
    getMonitoredPages: () => monitoredPages,
    getCollectingPaused: () => collectingPaused,
    setCollectingPaused: (v) => { collectingPaused = !!v; },
    getBrowser: () => browser,
    setupPageMonitoring,
    onTabSwitched: (p) => { monitoredPages = [p]; },
  });

  const switchTabs = createSwitchTabs({
    getBrowser: () => browser,
    onTabSwitched: (p) => { monitoredPages = [p]; },
    setupPageMonitoring,
    logBuffer,
    setSelectingTab: (v) => { isSelectingTab = v; },
  });

  // ===== MAIN =====
  // Track actual port to use (may change if auto-selecting free port)
  let actualPort = joinPort;

  if (isWsl()) {
    writeStatusLine(`${C.dim}Detecting Chrome...${C.reset}`);
    // Chrome Canary required for launching (isolated from regular Chrome singleton)
    const chromePath = detectWindowsChromeCanaryPath();

    // Profile path (same logic as open-mode: WSL → Windows LOCALAPPDATA, native → project dir)
    const profileLoc = getChromeProfileLocation(outputDir);
    const projectName = path.basename(outputDir);

    const { instances, chromeRunning } = scanChromeInstances();
    const projectMatch = findProjectChrome(instances, outputDir);

    // Show block only when Chrome not found / not reachable (errors)
    const showSetupBlock = !projectMatch.found || !chromePath;
    if (showSetupBlock) {
      clearStatusLine();
      console.log('');
      log.section('Join (WSL)');
      console.log(`  ${C.cyan}Project${C.reset} ${C.brightCyan}${projectName}${C.reset}  ${C.cyan}Profile${C.reset} ${C.dim}${profileLoc.path}${C.reset}`);
      if (instances.length > 0) {
        const line = instances.map((inst) => {
          const isOurs = projectMatch.found && projectMatch.instance === inst;
          const mark = isOurs ? `${C.green}*${C.reset}` : '';
          return `port ${inst.port}${mark}`;
        }).join(', ');
        console.log(`  ${C.cyan}Instances${C.reset} ${line}`);
      } else if (chromeRunning) {
        console.log(`  ${C.yellow}Chrome running without debug port${C.reset}`);
      } else {
        console.log(`  ${C.dim}Chrome not running${C.reset}`);
      }
      console.log('');
    }

    // Decide what to do based on status
    let shouldWaitForUser = false;
    let shouldLaunchChrome = false;
    let waitMessageContent = '';

    if (projectMatch.found && projectMatch.instance) {
      // Found Chrome with our project's profile - test if actually reachable
      actualPort = projectMatch.instance.port;
      writeStatusLine(`${C.dim}Checking connection to port ${actualPort}...${C.reset}`);

      // Actually test connectivity (don't trust bindAddress from command line)
      let isReachable = false;
      try {
        const testUrl = `http://${connectHost}:${actualPort}/json/version`;
        const response = await fetch(testUrl, { signal: AbortSignal.timeout(2000) });
        isReachable = response.ok;
      } catch {
        isReachable = false;
      }

      if (isReachable) {
        clearStatusLine();
        // Silent – compact block shown after connect
      } else {
        clearStatusLine();
        // Chrome exists but not reachable from WSL - port proxy needed
        shouldWaitForUser = true;
        waitMessageContent = [
          `${C.yellow}⚠ Chrome found but not accessible from WSL${C.reset}`,
          `${C.dim}Port proxy required (Chrome M113+ binds to 127.0.0.1 only)${C.reset}`,
          '',
          `${C.yellow}Close Chrome and re-run to retry.${C.reset}`,
        ].join('\n');
      }
    } else if (chromePath) {
      actualPort = findFreeDebugPort(instances, joinPort);
      clearStatusLine();
      console.log(`  ${C.yellow}No Chrome for this project.${C.reset} Port ${actualPort}, profile ${C.dim}${profileLoc.path}${C.reset}`);
      shouldLaunchChrome = await askYesNo(`  Launch Chrome Canary for this project?`);
    } else {
      // Chrome Canary not installed
      actualPort = findFreeDebugPort(instances, joinPort);
      clearStatusLine();
      printCanaryInstallInstructions();
      log.info('Install Chrome Canary and try again.');
      process.exit(1);
    }

    // Launch Chrome if needed
    if (shouldLaunchChrome && chromePath) {
      // Check if port proxy is blocking our port and remove it
      if (isPortBlocked(actualPort)) {
        clearStatusLine();
        log.info(`Port ${actualPort} is in use, checking for port proxy...`);
        const removed = removePortProxyIfExists(actualPort);
        if (!removed && isPortBlocked(actualPort)) {
          // Port is still blocked - try next free port
          clearStatusLine();
          log.warn(`Port ${actualPort} is blocked, trying next available...`);
          actualPort = findFreeDebugPort(instances, actualPort + 1);
          // Check the new port too
          if (isPortBlocked(actualPort)) {
            removePortProxyIfExists(actualPort);
          }
        }
      }

      // Kill any existing Chrome with browsermonitor profile to prevent singleton hijacking
      killPuppeteerMonitorChromes();

      clearStatusLine();
      log.info(`Launching Chrome on port ${actualPort}...`);
      const launched = startChromeOnWindows(chromePath, actualPort, profileLoc.path);
      if (launched) {
        writeStatusLine(`${C.dim}Waiting for Chrome to start...${C.reset}`);
        await new Promise(r => setTimeout(r, 2500));
        clearStatusLine();
      } else {
        log.error('Failed to launch Chrome automatically');
        shouldWaitForUser = true;
        waitMessageContent = `${C.yellow}Failed to launch Chrome automatically.${C.reset}`;
      }
    }

    // Wait for user if needed
    if (shouldWaitForUser) {
      clearStatusLine();
      const content = buildWaitForChromeContent(waitMessageContent);
      const table = createTable({ colWidths: [72], tableOpts: { wordWrap: true } });
      table.push([content]);
      printTable(table);
      await new Promise((resolve) => {
        process.stdin.setRawMode(false);
        process.stdin.resume();
        process.stdin.once('data', () => {
          resolve();
        });
      });
      console.log('');
    }

  }

  // Non-WSL: if no port given, scan for Chrome instances (with retry loop)
  if (!isWsl() && !actualPort) {
    const { getChromeInstances, askUserToSelectChromeInstance } = await import('../utils/chrome-instances.mjs');
    let instances = await getChromeInstances();
    while (instances.length === 0) {
      const hint = 'Start Chrome with: google-chrome --remote-debugging-port=9222';
      const titleContent = `${C.yellow}No Chrome with remote debugging found.${C.reset}\n${C.dim}${hint}${C.reset}`;
      const content = buildWaitForChromeContent(titleContent);
      const table = createTable({ colWidths: [72], tableOpts: { wordWrap: true } });
      table.push([content]);
      printTable(table);
      await new Promise((resolve) => {
        process.stdin.setRawMode?.(false);
        process.stdin.resume();
        process.stdin.once('data', () => {
          if (process.stdin.isTTY) process.stdin.setRawMode(true);
          resolve();
        });
      });
      console.log('');
      instances = await getChromeInstances();
    }
    actualPort = await askUserToSelectChromeInstance(instances);
    if (!actualPort) process.exit(0);
  }

  // Use actual port for connection (may have been changed by auto-detection)
  const finalBrowserURL = `http://${connectHost}:${actualPort}`;
  currentBrowserURL = finalBrowserURL;

  if (realtime) {
    fs.writeFileSync(logBuffer.CONSOLE_LOG, '');
    logBuffer.clearNetworkDir();
  }

  try {
    writeStatusLine(`${C.dim}Connecting to browser...${C.reset}`);
    // Connect to existing Chrome instance via Chrome DevTools Protocol (CDP).
    // defaultViewport: null preserves the browser's actual viewport size.
    browser = await puppeteer.connect({ browserURL: finalBrowserURL, defaultViewport: null });

    writeStatusLine(`${C.dim}Loading pages...${C.reset}`);
    const allPages = await browser.pages();

    const pages = filterUserPages(allPages);

    if (pages.length === 0) {
      clearStatusLine();
      log.error('No tabs found in browser');
      cleanup(1);
      return;
    }

    let selectedPage;
    if (pages.length === 1) {
      selectedPage = pages[0];
      clearStatusLine();
    } else {
      clearStatusLine();
      log.section('Tab Selection');
      console.log(`  ${C.cyan}Tabs${C.reset} ${pages.length} – select which to monitor:`);
      selectedPage = await askUserToSelectPage(pages);
      if (!selectedPage) {
        log.dim('Using first tab.');
        selectedPage = pages[0];
      }
    }

    monitoredPages = [selectedPage];
    setupPageMonitoring(selectedPage, 'Page');

    if (isWsl()) {
      printJoinConnectedBlock(connectHost, selectedPage.url());
    }

    // Watch for new tabs
    browser.on('targetcreated', async (target) => {
      if (target.type() === 'page') {
        const newPage = await target.page();
        if (newPage) log.dim(`New tab: ${newPage.url()}`);
      }
    });

    logBuffer.printConsoleSeparator('CONNECTED - Listening for console output');
    logBuffer.printNetworkSeparator('CONNECTED - Listening for network requests');

    clearStatusLine(true);
    printReadyHelp(httpPort, KEYS_JOIN);
    setupKeyboardInput({
      getActivePage: () => monitoredPages[0] || null,
      logBuffer,
      cleanup,
      switchTabs,
      printHelp,
      maybeShowHelp,
      isSelectingTab: () => isSelectingTab,
      getCollectingPaused: () => collectingPaused,
      setCollectingPaused: (v) => { collectingPaused = !!v; },
      getStatusInfo: async () => ({
        currentUrl: monitoredPages.map(p => p.url()).join(', '),
        tabCount: monitoredPages.length,
      }),
    });

    await new Promise(() => {});
  } catch (e) {
    clearStatusLine(true);
    if (e.message.includes('ECONNREFUSED') || e.message.includes('fetch failed') || e.message.includes('ETIMEDOUT') || e.message.includes('timeout')) {
      console.log('');
      log.error(`Cannot connect to Chrome at ${C.brightRed}${currentBrowserURL}${C.reset}`);
      console.log('');

      if (isWsl()) {
        // Run comprehensive WSL diagnostics
        const diagResult = await runWslDiagnostics(actualPort, connectHost);

        // Handle port proxy conflict automatically
        if (diagResult.hasPortProxyConflict) {
          console.log('');
          console.log(`${C.bold}${C.green}═══════════════════════════════════════════════════════════════════════════════${C.reset}`);
          console.log(`${C.bold}${C.green}  AUTOMATIC FIX${C.reset}`);
          console.log(`${C.bold}${C.green}═══════════════════════════════════════════════════════════════════════════════${C.reset}`);
          console.log('');

          const shouldFix = await askYesNo('Do you want me to fix this automatically? (remove port proxy, restart Chrome)');

          if (shouldFix) {
            const fixPort = diagResult.actualPort || actualPort;

            console.log(`${C.cyan}[1/2]${C.reset} Removing port proxy for port ${fixPort}...`);
            try {
              execSync(`netsh.exe interface portproxy delete v4tov4 listenport=${fixPort} listenaddress=0.0.0.0`, { encoding: 'utf8', timeout: 5000 });
              console.log(`  ${C.green}✓${C.reset} Port proxy removed`);
            } catch (err) {
              console.log(`  ${C.yellow}!${C.reset} Could not remove port proxy (may need admin): ${err.message}`);
            }

            console.log(`${C.cyan}[2/2]${C.reset} Stopping Chrome...`);
            try {
              killPuppeteerMonitorChromes(true);
              console.log(`  ${C.green}✓${C.reset} Chrome stopped`);
            } catch (err) {
              console.log(`  ${C.yellow}!${C.reset} Could not stop Chrome: ${err.message}`);
            }

            console.log('');
            console.log(`${C.green}Fix applied!${C.reset} Please run browsermonitor again.`);
            console.log(`${C.dim}Chrome will now bind to 0.0.0.0 correctly (no port proxy needed).${C.reset}`);
            console.log('');
            process.exit(0);
          }
        }
      } else {
        // Non-WSL: show basic help
        console.log(`  ${C.yellow}Make sure Chrome is running with remote debugging enabled:${C.reset}`);
        console.log(`    ${C.dim}Windows:${C.reset} ${C.cyan}chrome.exe --remote-debugging-port=${actualPort}${C.reset}`);
        console.log(`    ${C.dim}Linux:${C.reset}   ${C.cyan}google-chrome --remote-debugging-port=${actualPort}${C.reset}`);
        console.log(`    ${C.dim}Mac:${C.reset}     ${C.cyan}/Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --remote-debugging-port=${actualPort}${C.reset}`);
        console.log('');
        console.log(`  ${C.yellow}If connecting from remote server, create SSH reverse tunnel first:${C.reset}`);
        console.log(`    ${C.cyan}ssh -R ${actualPort}:localhost:${actualPort} user@this-server${C.reset}`);
        console.log('');
      }
    } else {
      log.error(e.message);
    }
    process.exit(1);
  }
}
