/**
 * browsermonitor init – creates settings.json with defaults, updates agent files.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  ensureDirectories,
  loadSettings,
  DEFAULT_SETTINGS,
} from './settings.mjs';
import { C } from './utils/colors.mjs';
import { printBulletBox } from './templates/section-heading.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const BEGIN_TAG_PREFIX = '<!-- BEGIN browser-monitor-llm-section';
const END_TAG_PREFIX = '<!-- END browser-monitor-llm-section';

const TEMPLATE_PATH = path.resolve(__dirname, 'agents.llm/browser-monitor-section.md');

/**
 * Replace existing tagged block or append template to a doc file.
 */
function replaceOrAppendSection(hostDir, docFilename, templateContent) {
  const hostPath = path.join(hostDir, docFilename);
  if (!fs.existsSync(hostPath)) return null;

  const content = fs.readFileSync(hostPath, 'utf8');
  const trimmedTemplate = templateContent.trimEnd();
  const beginIndex = content.indexOf(BEGIN_TAG_PREFIX);

  let newContent;
  let action;
  if (beginIndex === -1) {
    newContent = content.trimEnd() + '\n\n' + trimmedTemplate + '\n';
    action = 'appended';
  } else {
    const endTagStartIndex = content.indexOf(END_TAG_PREFIX, beginIndex);
    if (endTagStartIndex === -1) return null;
    const afterEndComment = content.indexOf('-->', endTagStartIndex) + 3;
    const lineEnd = content.indexOf('\n', afterEndComment);
    const endIndex = lineEnd === -1 ? content.length : lineEnd + 1;
    newContent = content.slice(0, beginIndex) + trimmedTemplate + '\n' + content.slice(endIndex);
    action = 'replaced';
  }

  try {
    fs.writeFileSync(hostPath, newContent);
    return action;
  } catch {
    return null;
  }
}

/**
 * Run browsermonitor initialization.
 */
export async function runInit(projectRoot, config = {}) {
  // Merge: explicit config > saved settings > defaults
  const saved = loadSettings(projectRoot);
  config = { ...DEFAULT_SETTINGS, ...saved, ...config };
  const { updateAgentFiles = true } = config;

  ensureDirectories(projectRoot);

  // Update agent files (render template with settings values)
  const agentUpdates = [];
  if (updateAgentFiles && fs.existsSync(TEMPLATE_PATH)) {
    let templateContent = fs.readFileSync(TEMPLATE_PATH, 'utf8');
    templateContent = templateContent
      .replace(/\{\{DEFAULT_URL\}\}/g, config.defaultUrl)
      .replace(/\{\{HTTP_PORT\}\}/g, String(config.httpPort));
    for (const docFile of ['CLAUDE.md', 'AGENTS.md', 'memory.md']) {
      const action = replaceOrAppendSection(projectRoot, docFile, templateContent);
      if (action) agentUpdates.push(`${action} ${C.cyan}${docFile}${C.reset}`);
    }
  }

  // Gitignore check
  let gitignoreHint = null;
  const gitignorePath = path.join(projectRoot, '.gitignore');
  if (fs.existsSync(gitignorePath)) {
    const content = fs.readFileSync(gitignorePath, 'utf8');
    if (!content.includes('.browsermonitor')) {
      gitignoreHint = `${C.yellow}Tip:${C.reset} add ${C.cyan}.browsermonitor/${C.reset} to .gitignore`;
    }
  }

  // Display results
  const lines = [
    `${C.cyan}Project:${C.reset} ${projectRoot}`,
    `${C.green}Created${C.reset} .browsermonitor/`,
  ];
  if (config.defaultUrl) {
    lines[1] += ` → ${C.cyan}${config.defaultUrl}${C.reset}`;
  }
  if (agentUpdates.length > 0) {
    lines.push(`${C.green}Agent docs:${C.reset} ${agentUpdates.join(', ')}`);
  }
  if (gitignoreHint) lines.push(gitignoreHint);

  console.log('');
  printBulletBox(lines);
  console.log('');
}
