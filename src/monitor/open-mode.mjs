/**
 * Open Mode - launch new Chrome and monitor.
 */

import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { C, log } from '../utils/colors.mjs';
import {
  isWsl,
  getWindowsHostForWSL,
  getLastCmdStderrAndClear,
  getWindowsLocalAppData,
  detectWindowsChromeCanaryPath,
  printCanaryInstallInstructions,
  killPuppeteerMonitorChromes,
  scanChromeInstances,
  runWslDiagnostics,
} from '../os/wsl/index.mjs';
import { LogBuffer } from '../logging/index.mjs';
import { askYesNo } from '../utils/ask.mjs';
import { printReadyHelp, KEYS_OPEN } from '../templates/ready-help.mjs';
import { printModeHeading, printBulletBox } from '../templates/section-heading.mjs';
import { createTable, printTable } from '../templates/table-helper.mjs';
import { writeStatusLine, clearStatusLine } from '../utils/status-line.mjs';
import { getProfileIdFromProjectDir } from '../utils/profile-id.mjs';
import {
  filterUserPages,
  createSetupPageMonitoring,
  createHelpHandlers,
  wireHttpState,
  createSwitchTabs,
  createCleanup,
  setupKeyboardInput,
} from './shared/index.mjs';

// Browser and page in module scope for cleanup
let browser = null;
let page = null;
let launchedOnWindows = false;
let windowsDebugPort = 0;


/**
 * Run in Open Mode - launch new Chrome and monitor
 * @param {string} url - URL to monitor
 * @param {Object} options - Monitor options
 */
export async function runOpenMode(url, options = {}) {
  const {
    realtime = false,
    headless = false,
    outputDir,
    paths,
    ignorePatterns = [],
    hardTimeout = 0,
    defaultTimeout = 30_000,
    navigationTimeout = 60_000,
    httpPort,
    sharedHttpState,
    sharedHttpServer,
    skipProfileBlock = false,
    skipModeHeading = false,
  } = options;

  const lazyMode = !realtime;

  // Create LogBuffer instance for centralized buffer management
  const logBuffer = new LogBuffer({
    outputDir,
    paths,
    lazyMode,
    ignorePatterns,
  });

  // Chrome profile dir (Linux-accessible path for prefs config).
  // On WSL, the Windows --user-data-dir is computed separately below.
  const USER_DATA_DIR = paths.chromeProfileDir;
  const PID_FILE = paths.pidFile;

  // HTTP server for LLM dump endpoint
  let httpServer = sharedHttpServer;

  // Track monitored pages for tab switching
  let monitoredPages = [];
  let isSelectingTab = false;
  let currentProfilePath = null;
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
        if (launchedOnWindows) {
          br.disconnect();
          try {
            const killed = killPuppeteerMonitorChromes(true);
            if (killed > 0) {
              log.success('Chrome closed');
            } else {
              log.dim('Chrome may have already closed');
            }
          } catch {
            log.dim('Chrome may have already closed');
          }
        } else {
          await br.close();
          log.success('Browser closed');
        }
      } else {
        br.disconnect();
        log.success('Disconnected (Chrome still running)');
      }
    },
    afterCleanup: () => {
      try { fs.unlinkSync(PID_FILE); } catch {}
    },
    hardTimeout,
  });

  const { maybeShowHelp, printHelp } = createHelpHandlers({
    httpPort,
    keysVariant: KEYS_OPEN,
    logBuffer,
    outputDir,
    modeLabel: 'Launch mode',
    getCurrentUrl: () => page?.url?.() || url,
    getProfilePath: () => currentProfilePath,
    getBrowserUrl: () => null,
  });

  wireHttpState(sharedHttpState, {
    mode: 'launch',
    logBuffer,
    getMonitoredPages: () => monitoredPages,
    getCollectingPaused: () => collectingPaused,
    setCollectingPaused: (v) => { collectingPaused = !!v; },
    getBrowser: () => browser,
    setupPageMonitoring,
    onTabSwitched: (p) => { page = p; monitoredPages = [p]; },
  });

  const switchTabs = createSwitchTabs({
    getBrowser: () => browser,
    onTabSwitched: (p) => { page = p; monitoredPages = [p]; },
    setupPageMonitoring,
    logBuffer,
    setSelectingTab: (v) => { isSelectingTab = v; },
  });

  // Initialize
  if (!skipModeHeading) printModeHeading('Open mode');
  if (realtime) {
    fs.writeFileSync(logBuffer.CONSOLE_LOG, '');
    logBuffer.clearNetworkDir();
  }

  writeStatusLine(`${C.dim}Launching browser for ${url}...${C.reset}`);
  const configLines = [
    `${C.cyan}Configuration${C.reset}`,
    `  Mode: ${lazyMode ? `${C.green}LAZY${C.reset} (buffered)` : `${C.yellow}REALTIME${C.reset} (immediate write)`}`,
    `  Browser: ${headless ? `${C.dim}HEADLESS${C.reset}` : `${C.green}GUI${C.reset}`}`,
  ].join('\n');
  clearStatusLine(true);
  const configTable = createTable({ colWidths: [95], tableOpts: { wordWrap: true } });
  configTable.push([configLines]);
  printTable(configTable);

  if (realtime) {
    logBuffer.printNetworkSeparator('BROWSERMONITOR STARTED');
    logBuffer.logNetwork(`URL: ${url}`);
    logBuffer.logNetwork('');
  }

  // ===== CONFIGURE CHROME PROFILE (only when Chrome will use USER_DATA_DIR) =====
  // On WSL with project on WSL fs (/srv/...), Chrome uses Windows LOCALAPPDATA - skip creating Linux path
  const chromeUsesUserDataDir = !isWsl() || outputDir.startsWith('/mnt/');
  if (chromeUsesUserDataDir) {
    const prefsDir = path.join(USER_DATA_DIR, 'Default');
    const prefsFile = path.join(prefsDir, 'Preferences');
    try {
      fs.mkdirSync(prefsDir, { recursive: true });
      let prefs = {};
      if (fs.existsSync(prefsFile)) {
        try {
          prefs = JSON.parse(fs.readFileSync(prefsFile, 'utf8'));
        } catch { /* ignore parse errors, start fresh */ }
      }
      prefs.session = prefs.session || {};
      prefs.session.restore_on_startup = 5;
      prefs.profile = prefs.profile || {};
      prefs.profile.exit_type = 'Normal';
      fs.writeFileSync(prefsFile, JSON.stringify(prefs, null, 2));
    } catch (e) {
      log.dim(`Could not configure profile preferences: ${e.message}`);
    }
  }

  // ===== MAIN TRY/FINALLY BLOCK =====
  try {
    if (isWsl()) {
      // === WSL MODE: Launch Chrome on Windows via PowerShell ===
      writeStatusLine(`${C.dim}Detecting Chrome...${C.reset}`);

      // For launch mode we use only Chrome Canary (isolated from user's regular Chrome)
      const chromePath = detectWindowsChromeCanaryPath();
      if (!chromePath) {
        clearStatusLine();
        printCanaryInstallInstructions();
        log.info('Install Chrome Canary and try again.');
        process.exit(1);
      }

      // In launch mode, kill any existing browsermonitor Chrome processes
      clearStatusLine(true);
      const killed = killPuppeteerMonitorChromes();
      if (killed > 0) {
        await new Promise(r => setTimeout(r, 1000));
      }

      // Check if Chrome is running - with or without debug port
      const { instances, chromeRunning } = scanChromeInstances();
      let chromeAlreadyRunning = false;
      let useExistingChrome = false;
      let existingDebugPort = null;

      if (chromeRunning) {
        if (instances.length > 0) {
          // Chrome is running WITH debug port - we can try to connect to it!
          existingDebugPort = instances[0].port;

          // Check if it's accessible from WSL or needs port proxy
          const connectHost = getWindowsHostForWSL();
          try {
            const testResponse = await fetch(`http://${connectHost}:${existingDebugPort}/json/version`, {
              signal: AbortSignal.timeout(2000)
            });
            if (testResponse.ok) {
              useExistingChrome = true;
            }
          } catch {
            // Not accessible - check if port proxy would help

            // Check if port proxy is already set up
            try {
              const portProxyList = execSync('netsh.exe interface portproxy show v4tov4 2>nul', { encoding: 'utf8', timeout: 5000 });
              if (!portProxyList.includes(String(existingDebugPort))) {
                // Offer to set up port proxy
                console.log('');
                console.log(`  ${C.yellow}Port proxy needed:${C.reset} Chrome is not accessible from WSL.`);
                console.log(`  ${C.dim}Run this in PowerShell (Admin) to fix:${C.reset}`);
                console.log(`  ${C.cyan}netsh interface portproxy add v4tov4 listenport=${existingDebugPort} listenaddress=0.0.0.0 connectport=${existingDebugPort} connectaddress=127.0.0.1${C.reset}`);
                console.log('');

                const shouldSetup = await askYesNo(`  ${C.bold}Try to set up port proxy now? (requires admin)${C.reset}`);
                if (shouldSetup) {
                    try {
                      // Try to run netsh (might need elevation)
                      execSync(`netsh.exe interface portproxy add v4tov4 listenport=${existingDebugPort} listenaddress=0.0.0.0 connectport=${existingDebugPort} connectaddress=127.0.0.1`, { encoding: 'utf8', timeout: 5000 });
                      // Test again
                      await new Promise(r => setTimeout(r, 500));
                      const retryResponse = await fetch(`http://${connectHost}:${existingDebugPort}/json/version`, {
                        signal: AbortSignal.timeout(2000)
                      });
                      if (retryResponse.ok) {
                        useExistingChrome = true;
                      }
                    } catch (e) {
                      log.warn('Could not set up port proxy (run PowerShell as Admin)');
                    }
                }
              }
            } catch {
              // netsh failed
            }
          }

          if (useExistingChrome) {
            windowsDebugPort = existingDebugPort;
          }
        } else {
          // Chrome running WITHOUT debug port - singleton problem
          chromeAlreadyRunning = true;
        }
      }

      // Skip launch if using existing Chrome
      let windowsUserDataDir = 'existing';

      if (!useExistingChrome) {
        // Find available port starting from 9222
        const findAvailablePort = () => {
          const START_PORT = 9222;
          const MAX_PORT = 9299;
          for (let port = START_PORT; port <= MAX_PORT; port++) {
            try {
              const checkCmd = `powershell.exe -NoProfile -Command "(Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue).Count"`;
              const result = execSync(checkCmd, { encoding: 'utf8', timeout: 3000 }).trim();
              const count = parseInt(result, 10) || 0;
              if (count === 0) {
                return port;
              }
            } catch {
              return port;
            }
          }
          return START_PORT + Math.floor(Math.random() * (MAX_PORT - START_PORT));
        };
        windowsDebugPort = findAvailablePort();

        // Get Windows user data dir
        if (USER_DATA_DIR.startsWith('/mnt/')) {
          windowsUserDataDir = USER_DATA_DIR.replace(/^\/mnt\/([a-z])\//, (_, drive) => `${drive.toUpperCase()}:\\`).replace(/\//g, '\\');
        } else {
          const { profileId } = getProfileIdFromProjectDir(outputDir);
          const localAppData = getWindowsLocalAppData();
          windowsUserDataDir = `${localAppData}\\browsermonitor\\${profileId}`;
        }

        // CMD.EXE stderr + Profile/Project in bullet box
        const cmdStderrLines = getLastCmdStderrAndClear();
        const mergedStderr = [];
        for (let i = 0; i < cmdStderrLines.length; i++) {
          const curr = cmdStderrLines[i];
          const next = cmdStderrLines[i + 1];
          if (next && /^'\\\\/.test(curr) && /CMD\.EXE was started/i.test(next)) {
            mergedStderr.push(`${next} ${curr}`);
            i++;
          } else {
            mergedStderr.push(curr);
          }
        }
        if (!skipProfileBlock) {
          const infoLines = [
            ...mergedStderr,
            `Profile: ${windowsUserDataDir}`,
          ];
          if (infoLines.length > 0) {
            clearStatusLine();
            console.log('');
            printBulletBox(infoLines, '  ', { dim: true });
          }
        }

        writeStatusLine(`${C.dim}Launching Chrome on Windows (port ${windowsDebugPort})...${C.reset}`);

        // Launch Chrome on Windows with user data dir
        // Escape single quotes for PowerShell literal strings (double them)
        const psEsc = (s) => s.replace(/'/g, "''");
        const psCommand = `Start-Process -FilePath '${psEsc(chromePath)}' -ArgumentList @('--remote-debugging-port=${windowsDebugPort}','--user-data-dir=${psEsc(windowsUserDataDir)}','--disable-session-crashed-bubble','--start-maximized','${psEsc(url)}')`;
        try {
          execSync(`powershell.exe -NoProfile -Command "${psCommand}"`, { encoding: 'utf8', timeout: 10000 });
          launchedOnWindows = true;

          // Set up port proxy AFTER Chrome starts
          clearStatusLine();
          writeStatusLine(`${C.dim}Setting up port proxy for WSL access...${C.reset}`);

          // Wait for Chrome to bind and detect address
          let chromeBindAddr = null;
          for (let i = 0; i < 10; i++) {
            try { execSync('powershell.exe -NoProfile -Command "Start-Sleep -Milliseconds 500"', { timeout: 2000 }); } catch {}
            try {
              const netstat = execSync(`netstat.exe -ano`, { encoding: 'utf8', timeout: 5000 });
              const lines = netstat.split('\n').filter(l => l.includes(':' + windowsDebugPort) && l.includes('LISTEN'));
              for (const line of lines) {
                if (line.includes('127.0.0.1:' + windowsDebugPort)) { chromeBindAddr = '127.0.0.1'; break; }
                else if (line.includes('[::1]:' + windowsDebugPort)) { chromeBindAddr = '::1'; break; }
              }
              if (chromeBindAddr) break;
            } catch {}
          }
          if (!chromeBindAddr) chromeBindAddr = '127.0.0.1';

          const proxyType = chromeBindAddr === '::1' ? 'v4tov6' : 'v4tov4';

          // Remove old proxies first
          try {
            execSync(`powershell.exe -NoProfile -Command "netsh interface portproxy delete v4tov4 listenport=${windowsDebugPort} listenaddress=0.0.0.0 2>\\$null; netsh interface portproxy delete v4tov6 listenport=${windowsDebugPort} listenaddress=0.0.0.0 2>\\$null"`, { encoding: 'utf8', timeout: 5000 });
          } catch {}

          try {
            execSync(
              `powershell.exe -NoProfile -Command "netsh interface portproxy add ${proxyType} listenport=${windowsDebugPort} listenaddress=0.0.0.0 connectport=${windowsDebugPort} connectaddress=${chromeBindAddr}"`,
              { encoding: 'utf8', timeout: 5000 }
            );
          } catch (proxyErr) {
            log.warn(`Could not set up port proxy (may need admin): ${proxyErr.message}`);
          }
        } catch (e) {
          log.error(`Failed to launch Chrome on Windows: ${e.message}`);
          process.exit(1);
        }
      }

      // Wait for Chrome to start and connect with retry
      clearStatusLine(true);
      const connectHost = getWindowsHostForWSL({ quiet: true });
      const browserURL = `http://${connectHost}:${windowsDebugPort}`;
      const wslSetupLines = [
        `${C.cyan}Open (WSL)${C.reset}`,
        `  ${C.yellow}WSL detected${C.reset} – Chrome on Windows (GPU/WebGL)`,
        `  Chrome Canary (isolated from regular Chrome)`,
        chromeAlreadyRunning ? `  ${C.yellow}Chrome already running${C.reset} – new window joins existing process` : '',
        `  Port: ${windowsDebugPort}  │  Connection: ${browserURL}`,
      ].filter(Boolean).join('\n');
      const wslTable = createTable({ colWidths: [95], tableOpts: { wordWrap: true } });
      wslTable.push([wslSetupLines]);
      printTable(wslTable);

      writeStatusLine(`${C.dim}Connecting to Chrome...${C.reset}`);

      // Retry connection up to 5 times (total ~7.5 seconds)
      const MAX_RETRIES = 5;
      const RETRY_DELAY = 1500;
      let lastError = null;

      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          await new Promise(r => setTimeout(r, RETRY_DELAY));
          writeStatusLine(`${C.dim}Connecting to Chrome (attempt ${attempt}/${MAX_RETRIES})...${C.reset}`);

          try {
            const versionUrl = `${browserURL}/json/version`;
            const response = await fetch(versionUrl, { signal: AbortSignal.timeout(3000) });
            if (response.ok) {
              const info = await response.json();
              writeStatusLine(`${C.dim}Chrome responding: ${info.Browser || 'unknown'}${C.reset}`);
            }
          } catch (fetchErr) {
            throw new Error(`Cannot reach Chrome debug endpoint: ${fetchErr.message}`);
          }

          browser = await puppeteer.connect({ browserURL, defaultViewport: null });
          clearStatusLine();
          lastError = null;
          break;
        } catch (e) {
          lastError = e;
        }
      }

      if (lastError) {
        log.error(`Failed to connect to Chrome after ${MAX_RETRIES} attempts: ${lastError.message}`);

        // Run comprehensive WSL diagnostics
        const diagResult = await runWslDiagnostics(windowsDebugPort, connectHost);

        // Handle port proxy conflict automatically
        if (diagResult.hasPortProxyConflict) {
          console.log('');
          console.log(`${C.bold}${C.green}═══════════════════════════════════════════════════════════════════════════════${C.reset}`);
          console.log(`${C.bold}${C.green}  AUTOMATIC FIX${C.reset}`);
          console.log(`${C.bold}${C.green}═══════════════════════════════════════════════════════════════════════════════${C.reset}`);
          console.log('');

          const shouldFix = await askYesNo('Do you want me to fix this automatically? (remove port proxy, restart Chrome)');

          if (shouldFix) {
            const fixPort = diagResult.actualPort || windowsDebugPort;

            console.log(`${C.cyan}[1/2]${C.reset} Removing port proxy for port ${fixPort}...`);
            try {
              execSync(`netsh.exe interface portproxy delete v4tov4 listenport=${fixPort} listenaddress=0.0.0.0`, { encoding: 'utf8', timeout: 5000 });
              console.log(`  ${C.green}✓${C.reset} Port proxy removed`);
            } catch (e) {
              console.log(`  ${C.yellow}!${C.reset} Could not remove port proxy (may need admin): ${e.message}`);
            }

            console.log(`${C.cyan}[2/2]${C.reset} Stopping Chrome...`);
            try {
              killPuppeteerMonitorChromes(true);
              console.log(`  ${C.green}✓${C.reset} Chrome stopped`);
            } catch (e) {
              console.log(`  ${C.yellow}!${C.reset} Could not stop Chrome: ${e.message}`);
            }

            console.log('');
            console.log(`${C.green}Fix applied!${C.reset} Please run browsermonitor again.`);
            console.log(`${C.dim}Chrome will now bind to 0.0.0.0 correctly (no port proxy needed).${C.reset}`);
            console.log('');
            process.exit(0);
          }
        }

        // Additional context for Chrome singleton issue
        if (chromeAlreadyRunning && !diagResult.hasPortProxyConflict) {
          console.log(`${C.yellow}Note:${C.reset} Chrome was already running when we tried to launch.`);
          console.log('      The new window joined the existing process without debug port.');
          console.log('');
          console.log(`${C.bold}Solution:${C.reset} Close ALL Chrome windows and try again.`);
          console.log('');
        }

        process.exit(1);
      }

      const connectedLines = [
        `${C.green}Connected to Chrome on Windows${C.reset}`,
        `  Chrome: Windows native (port ${windowsDebugPort})`,
        `${C.dim}Note: Separate Chrome profile – you may need to log in to websites.${C.reset}`,
      ].join('\n');
      const connectedTable = createTable({ colWidths: [95], tableOpts: { wordWrap: true } });
      connectedTable.push([connectedLines]);
      printTable(connectedTable);
      currentProfilePath = windowsUserDataDir === 'existing' ? null : windowsUserDataDir;

    } else {
      // === NATIVE MODE: Standard Puppeteer launch ===
      browser = await puppeteer.launch({
        headless: headless ? 'new' : false,
        userDataDir: USER_DATA_DIR,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--ignore-certificate-errors',
          '--disable-gpu',
          '--disable-software-rasterizer',
          '--remote-debugging-port=0',
          '--disable-session-crashed-bubble',
          ...(headless ? [] : ['--start-maximized']),
        ],
        defaultViewport: headless ? { width: 1920, height: 1080 } : null,
      });

      // Save Chrome PID to file for recovery
      const browserProcess = browser.process();
      const chromePid = browserProcess ? browserProcess.pid : null;

      if (chromePid) {
        fs.writeFileSync(PID_FILE, String(chromePid));
      }
      const nativeLines = [
        `${C.green}Connected to Chrome${C.reset}`,
        `  Browser profile: ${USER_DATA_DIR}`,
        chromePid ? `  PID: ${chromePid}  │  PID file: ${PID_FILE}` : '',
        chromePid ? `${C.dim}If stuck: kill -9 $(cat ${PID_FILE})${C.reset}` : '',
      ].filter(Boolean).join('\n');
      const nativeTable = createTable({ colWidths: [95], tableOpts: { wordWrap: true } });
      nativeTable.push([nativeLines]);
      printTable(nativeTable);
      currentProfilePath = USER_DATA_DIR;
    }

    // Pick best page: prefer a real user page (Chrome may already have our URL from launch),
    // fall back to about:blank, or create a new page.
    const initialPages = await browser.pages();
    const userPages = filterUserPages(initialPages);
    page = userPages[0] || initialPages.find((p) => p.url() === 'about:blank') || initialPages[0] || await browser.newPage();
    monitoredPages = [page];

    // ===== SET TIMEOUTS =====
    page.setDefaultTimeout(defaultTimeout);
    page.setDefaultNavigationTimeout(navigationTimeout);

    // ===== SETUP PAGE MONITORING (console, network events) =====
    setupPageMonitoring(page);

    writeStatusLine(`${C.dim}Navigating to ${url}...${C.reset}`);
    if (realtime) {
      logBuffer.logConsole(`[Monitor] Navigating to ${url}...`);
    }
    logBuffer.printNetworkSeparator('NAVIGATION STARTED');

    try {
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: navigationTimeout,
      });
      clearStatusLine();
      logBuffer.printConsoleSeparator('PAGE LOADED - Listening for console output');
      logBuffer.printNetworkSeparator('PAGE LOADED - Listening for network requests');
    } catch (navErr) {
      clearStatusLine();
      log.warn(`Navigation failed: ${navErr.message}`);
      log.info('Browser is still open. You can navigate manually or retry.');
      logBuffer.logConsole(`[Monitor] Navigation to ${url} failed: ${navErr.message}`);
      logBuffer.printConsoleSeparator('NAVIGATION FAILED - Listening for console output');
    }

    // Clean up leftover tabs. Open-mode uses Chrome Canary (isolated from regular Chrome),
    // so tabs here are from browsermonitor. Close only about:blank and internal pages;
    // keep real user pages (they may be the tab the user is looking at).
    const allPages = await browser.pages();
    for (const p of allPages) {
      if (p === page || p.isClosed()) continue;
      const u = p.url();
      if (u === 'about:blank' || u.startsWith('chrome://') || u.startsWith('chrome-extension://')) {
        log.dim(`Closing leftover tab: ${u}`);
        await p.close().catch(() => {});
      }
    }

    if (realtime) {
      logBuffer.logConsole(`[Monitor] URL: ${url}`);
      logBuffer.logConsole(`[Monitor] Press Ctrl+C to stop.`);
      logBuffer.logConsole(`[Monitor] Type console.clear() in browser to reset console log.`);
      logBuffer.logConsole('');
    } else {
      // Lazy mode: Ready block from template (same as periodic reminder)
      printReadyHelp(httpPort, KEYS_OPEN);
      setupKeyboardInput({
        getActivePage: () => page,
        logBuffer,
        cleanup,
        switchTabs,
        printHelp,
        maybeShowHelp,
        isSelectingTab: () => isSelectingTab,
        getCollectingPaused: () => collectingPaused,
        setCollectingPaused: (v) => { collectingPaused = !!v; },
        getStatusInfo: async () => ({
          currentUrl: page ? page.url() : 'N/A',
          tabCount: browser ? (await browser.pages()).length : 0,
        }),
      });
    }

    // Keep process running until signal
    await new Promise(() => {});
  } finally {
    // Ensure browser is closed even if something goes wrong
    if (browser) {
      try {
        await browser.close();
        log.dim('Browser closed in finally block');
      } catch (e) {
        log.error(`Error closing browser in finally: ${e.message}`);
      }
    }

    try {
      fs.unlinkSync(PID_FILE);
    } catch {}
  }
}
