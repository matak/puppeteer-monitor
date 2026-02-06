#!/usr/bin/env node
/**
 * One-off script to extract runJoinMode and runOpenMode from monitor.mjs into join-mode.mjs and open-mode.mjs.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const monitorPath = path.join(root, 'src/monitor.mjs');
const full = fs.readFileSync(monitorPath, 'utf8');
const lines = full.split('\n');

const joinImports = `/**
 * Join Mode - attach to existing Chrome (connect to running browser).
 */

import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { execSync } from 'child_process';
import { C, log } from '../colors.mjs';
import {
  getWindowsHostForWSL,
  getWindowsProfilePath,
  detectWindowsChromePath,
  scanChromeInstances,
  findProjectChrome,
  findFreeDebugPort,
  startChromeOnWindows,
  killPuppeteerMonitorChromes,
  removePortProxyIfExists,
  isPortBlocked,
  runWslDiagnostics,
} from '../wsl/index.mjs';
import { LogBuffer } from '../logging.mjs';
import { createHttpServer } from '../http-server.mjs';
import { setupPageMonitoring as setupPageMonitoringShared } from './page-monitoring.mjs';
import { askUserToSelectPage } from './tab-selection.mjs';
import { askProjectDirForOpen } from './standby-mode.mjs';
import { askYesNo } from './utils.mjs';

`;

// runJoinMode: lines 66-771 (1-based) = index 65-770
const joinBody = lines.slice(65, 771).join('\n');
fs.writeFileSync(path.join(root, 'src/monitor/join-mode.mjs'), joinImports + joinBody);
console.log('Written src/monitor/join-mode.mjs');

// runOpenMode: lines 773-1649 (1-based) = index 772-1648, and module-level vars 772-778
const openImports = `/**
 * Open Mode - launch new Chrome and monitor.
 */

import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { execSync } from 'child_process';
import crypto from 'crypto';
import { C, log } from '../colors.mjs';
import {
  getWindowsHostForWSL,
  detectWindowsChromeCanaryPath,
  detectWindowsChromePath,
  printCanaryInstallInstructions,
  killPuppeteerMonitorChromes,
  checkChromeRunning,
  runWslDiagnostics,
} from '../wsl/index.mjs';
import { LogBuffer, getTimestamp, getFullTimestamp } from '../logging.mjs';
import { createHttpServer } from '../http-server.mjs';
import { setupPageMonitoring as setupPageMonitoringShared } from './page-monitoring.mjs';
import { askUserToSelectPage } from './tab-selection.mjs';
import { askYesNo } from './utils.mjs';

// Browser and page in module scope for cleanup
let browser = null;
let page = null;
let cleanupDone = false;
let launchedOnWindows = false;
let windowsDebugPort = 0;

`;

// runOpenMode function: lines 780-1649 (1-based) = index 779-1648
const openBody = lines.slice(779, 1649).join('\n');
fs.writeFileSync(path.join(root, 'src/monitor/open-mode.mjs'), openImports + openBody);
console.log('Written src/monitor/open-mode.mjs');
