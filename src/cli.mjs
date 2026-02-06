#!/usr/bin/env node
/**
 * Puppeteer Monitor CLI
 *
 * Mode is chosen by arguments (before anything else):
 *   (none)     → Interactive: menu (o = open, j = join, q = quit)
 *   --open     → Open mode: launch new Chrome and monitor
 *   --join=PORT→ Join mode: attach to existing Chrome at localhost:PORT (port required)
 *
 * Options:
 *   --realtime       Write logs immediately (default: lazy)
 *   --headless       Run in headless mode (default: GUI)
 *   --timeout=MS     Hard timeout in ms (default: disabled)
 *   --nav-timeout=MS Navigation timeout in ms (default: 60000)
 *   --help           Show help
 *
 * Configuration in host package.json:
 *   "puppeteer-monitor": {
 *     "defaultUrl": "https://localhost:5173/",
 *     "headless": false,
 *     "navigationTimeout": 0,
 *     "ignorePatterns": ["CustomNoise"]
 *   }
 */

import { runInteractiveMode, runJoinMode, runOpenMode } from './monitor.mjs';
import { printAppIntro } from './intro.mjs';
import { createHttpServer } from './http-server.mjs';
import { printApiHelpTable } from './templates/api-help.mjs';
import { printCliCommandsTable } from './templates/cli-commands.mjs';
import { askHttpPort } from './utils/ask.mjs';
import { C } from './utils/colors.mjs';
import fs from 'fs';
import path from 'path';

// Load configuration from host package.json
function loadConfig() {
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  try {
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      return packageJson['puppeteer-monitor'] || {};
    }
  } catch (e) {
    // Ignore errors reading package.json
  }
  return {};
}

const config = loadConfig();

// Parse arguments
const args = process.argv.slice(2);

// Show help
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Puppeteer Monitor – capture browser console, network, and DOM for debugging and LLM workflows.

What it does:
  Connects to Chrome (via Puppeteer) and records console output, network requests, cookies,
  and the current page HTML. Logs can be written to files on demand (lazy) or in real time.
  Useful for debugging frontend apps, E2E flows, and feeding context to AI assistants
  (e.g. read puppeteer-dom.html for the live DOM).

`);
  printCliCommandsTable({ showEntry: true, showUsage: true });
  console.log(`
Modes (chosen by flags; only one applies):
  INTERACTIVE (default)   No flag. Asks for project root, then menu:
                            o = open Chrome (launch and monitor)
                            j = join running Chrome (pick instance/tab)
                            q = quit

  OPEN (--open)           Launch a new Chrome and monitor it. URL = first positional or config.
                          Uses current directory for logs. Good for local dev with a fresh profile.

  JOIN (--join=PORT)      Attach to an existing Chrome with remote debugging on PORT.
                          Port is required (e.g. --join=9222). Use when Chrome is already
                          running (e.g. started by a script or on another machine via tunnel).

Options:
  --port=PORT             HTTP API port (default: 60001; if omitted, you will be asked in interactive)
  --realtime              Write each event to files immediately (default: lazy, buffer in memory)
  --headless              Run Chrome without GUI
  --open                  Go directly to open mode
  --join=PORT             Go directly to join mode (PORT required)
  --timeout=MS            Hard timeout in ms; process exits after (0 = disabled)
  --nav-timeout=MS        Navigation timeout in ms (default: 60000, 0 = no limit)
  --help, -h              Show this help

Config (package.json "puppeteer-monitor"):
  defaultUrl, headless, navigationTimeout, ignorePatterns (regex for console filter)

`);
  printApiHelpTable({ port: 60001, showApi: true, showInteractive: false, showOutputFiles: true });
  process.exit(0);
}

// ---- Mode dispatch: --open | --join=PORT | standby ----
const openMode = args.some((a) => a === '--open' || a.startsWith('--open='));
const joinArg = args.find((a) => a.startsWith('--join'));
let joinPort = null;
if (joinArg) {
  if (joinArg === '--join' || !joinArg.includes('=')) {
    console.error('Error: --join requires a port (e.g. --join=9222)');
    process.exit(1);
  }
  const portStr = joinArg.split('=')[1];
  joinPort = parseInt(portStr, 10);
  if (Number.isNaN(joinPort) || joinPort < 1 || joinPort > 65535) {
    console.error(`Error: invalid port for --join: ${portStr}`);
    process.exit(1);
  }
}

// Shared options
const realtimeMode = args.includes('--realtime');
const headlessCli = args.includes('--headless');
const timeoutArg = args.find((a) => a.startsWith('--timeout='));
const hardTimeout = timeoutArg ? parseInt(timeoutArg.split('=')[1], 10) : 0;
const navTimeoutArg = args.find((a) => a.startsWith('--nav-timeout='));
const navigationTimeout = navTimeoutArg
  ? parseInt(navTimeoutArg.split('=')[1], 10)
  : (config.navigationTimeout !== undefined ? config.navigationTimeout : 60_000);
const urlFromArgs = args.find((a) => !a.startsWith('--'));
const url = urlFromArgs || config.defaultUrl || 'https://localhost:4000/';
const headless = headlessCli || config.headless || false;
const ignorePatterns = config.ignorePatterns || [];
const outputDir = process.cwd();

const DEFAULT_HTTP_PORT = 60001;
const portArg = args.find((a) => a === '--port' || a.startsWith('--port='));
let httpPortFromArgs = null;
if (portArg) {
  const val = portArg.includes('=') ? portArg.split('=')[1] : '';
  const num = parseInt(val, 10);
  if (!Number.isNaN(num) && num >= 1 && num <= 65535) httpPortFromArgs = num;
}

(async () => {
  printAppIntro();

  printApiHelpTable({ port: DEFAULT_HTTP_PORT, showApi: true, showInteractive: false, showOutputFiles: true, noLeadingNewline: true });

  const httpPort =
    httpPortFromArgs ?? (process.stdin.isTTY ? await askHttpPort(DEFAULT_HTTP_PORT) : DEFAULT_HTTP_PORT);

  const sharedHttpState = {
    mode: 'interactive',
    logBuffer: null,
    getPages: () => [],
    getCollectingPaused: () => false,
    setCollectingPaused: () => {},
    switchToTab: async () => ({ success: false, error: 'No browser connected' }),
    getAllTabs: async () => [],
  };
  const sharedHttpServer = createHttpServer({
    port: httpPort,
    defaultPort: DEFAULT_HTTP_PORT,
    getState: () => sharedHttpState,
  });

  const commonOptions = {
    realtime: realtimeMode,
    outputDir,
    ignorePatterns,
    hardTimeout,
    httpPort,
    sharedHttpState,
    sharedHttpServer,
  };

  if (openMode) {
    console.log(`  [CLI] Open mode → ${url}`);
    await runOpenMode(url, {
      ...commonOptions,
      headless,
      navigationTimeout,
    });
  } else if (joinPort !== null) {
    console.log(`  [CLI] Join mode → localhost:${joinPort}`);
    await runJoinMode(joinPort, {
      ...commonOptions,
      defaultUrl: url,
    });
  } else {
    await runInteractiveMode({
      ...commonOptions,
      defaultUrl: url,
      headless,
      navigationTimeout,
    });
  }
})();
