#!/usr/bin/env node
/**
 * Initialize puppeteer-monitor in host project:
 * 1. Adds 'browsermonitor' script to package.json
 * 2. Inserts or replaces Browser Monitor (LLM) section in CLAUDE.md, AGENTS.md, memory.md (if present).
 *    Section is delimited by BEGIN/END tags; template in src/agents.llm/browser-monitor-section.md.
 *
 * Usage: npx puppeteer-monitor-init
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SCRIPT_BROWSERMONITOR = 'puppeteer-monitor';

const BEGIN_TAG_PREFIX = '<!-- BEGIN browser-monitor-llm-section';
const END_TAG_PREFIX = '<!-- END browser-monitor-llm-section';

const TEMPLATE_PATH = path.resolve(__dirname, 'agents.llm/browser-monitor-section.md');

function findHostPackageJson() {
  const cwdPackageJson = path.join(process.cwd(), 'package.json');
  if (fs.existsSync(cwdPackageJson)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(cwdPackageJson, 'utf8'));
      if (pkg.name !== 'puppeteer-monitor') {
        return cwdPackageJson;
      }
    } catch {
      // fall through
    }
  }
  return null;
}

function addScriptToPackageJson(hostPackageJsonPath) {
  try {
    const content = fs.readFileSync(hostPackageJsonPath, 'utf8');
    const packageJson = JSON.parse(content);
    packageJson.scripts = packageJson.scripts || {};

    if (packageJson.scripts.browsermonitor) {
      console.log('[puppeteer-monitor] Script browsermonitor already configured');
      return false;
    }
    packageJson.scripts.browsermonitor = SCRIPT_BROWSERMONITOR;
    fs.writeFileSync(hostPackageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
    console.log('[puppeteer-monitor] Added script: browsermonitor');
    return true;
  } catch (err) {
    console.error('[puppeteer-monitor] Could not update package.json:', err.message);
    return false;
  }
}

/**
 * Replace existing tagged block or append template. Section is identified by BEGIN/END tags.
 * @param {string} hostDir
 * @param {string} docFilename - e.g. 'CLAUDE.md', 'AGENTS.md', 'memory.md'
 * @param {string} templateContent - full block including BEGIN and END tags
 * @returns {boolean} true if file was updated
 */
function replaceOrAppendSection(hostDir, docFilename, templateContent) {
  const hostPath = path.join(hostDir, docFilename);
  if (!fs.existsSync(hostPath)) return false;

  const content = fs.readFileSync(hostPath, 'utf8');
  const trimmedTemplate = templateContent.trimEnd();
  const beginIndex = content.indexOf(BEGIN_TAG_PREFIX);

  let newContent;
  if (beginIndex === -1) {
    newContent = content.trimEnd() + '\n\n' + trimmedTemplate + '\n';
    console.log(`[puppeteer-monitor] Appended Browser Monitor section to ${docFilename}`);
  } else {
    const endTagStartIndex = content.indexOf(END_TAG_PREFIX, beginIndex);
    if (endTagStartIndex === -1) {
      console.error(`[puppeteer-monitor] ${docFilename}: BEGIN tag found but no END tag; skipping`);
      return false;
    }
    const afterEndComment = content.indexOf('-->', endTagStartIndex) + 3;
    const lineEnd = content.indexOf('\n', afterEndComment);
    const endIndex = lineEnd === -1 ? content.length : lineEnd + 1;
    newContent = content.slice(0, beginIndex) + trimmedTemplate + '\n' + content.slice(endIndex);
    console.log(`[puppeteer-monitor] Replaced Browser Monitor section in ${docFilename}`);
  }

  try {
    fs.writeFileSync(hostPath, newContent);
    return true;
  } catch (err) {
    console.error(`[puppeteer-monitor] Could not write ${docFilename}:`, err.message);
    return false;
  }
}

async function main() {
  console.log('');
  console.log('========================================');
  console.log('  Puppeteer Monitor - Setup');
  console.log('========================================');
  console.log('');

  const hostPackageJsonPath = findHostPackageJson();
  if (!hostPackageJsonPath) {
    console.error('[puppeteer-monitor] No package.json found in current directory');
    console.error('[puppeteer-monitor] Run this command from your project root');
    process.exit(1);
  }

  if (!fs.existsSync(TEMPLATE_PATH)) {
    console.error('[puppeteer-monitor] Template not found:', TEMPLATE_PATH);
    process.exit(1);
  }

  const templateContent = fs.readFileSync(TEMPLATE_PATH, 'utf8');
  const hostDir = path.dirname(hostPackageJsonPath);
  console.log(`[puppeteer-monitor] Project: ${hostDir}`);
  console.log('');

  addScriptToPackageJson(hostPackageJsonPath);
  replaceOrAppendSection(hostDir, 'CLAUDE.md', templateContent);
  replaceOrAppendSection(hostDir, 'AGENTS.md', templateContent);
  replaceOrAppendSection(hostDir, 'memory.md', templateContent);

  console.log('');
  console.log('[puppeteer-monitor] Setup complete.');
  console.log('  pnpm browsermonitor   - Interactive menu (o=open, j=join, q=quit)');
  console.log('');
}

main().catch((err) => {
  console.error('[puppeteer-monitor] Error:', err.message);
  process.exit(1);
});
