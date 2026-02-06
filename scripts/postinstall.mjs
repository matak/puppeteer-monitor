#!/usr/bin/env node
/**
 * Postinstall script - adds 'browsermonitor' script to host project's package.json
 * and prints WSL usage instructions
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SCRIPT_NAME = 'browsermonitor';
const SCRIPT_COMMAND = 'puppeteer-monitor';

const CLAUDE_MD_SECTION = `
## Browser Debugging (puppeteer-monitor)

This project has puppeteer-monitor installed for browser console and network debugging.

### How to Get Browser Logs

When debugging browser issues, you can fetch console and network logs:

\`\`\`bash
# Trigger dump of browser logs (requires monitor running)
curl -s http://127.0.0.1:60001/dump

# Check monitor status
curl -s http://127.0.0.1:60001/status
\`\`\`

### Output Files (relative to project root)

| File | Content |
|------|---------|
| \`puppeteer-console.log\` | Browser console output (console.log, errors, warnings) |
| \`puppeteer-network.log\` | Network requests summary (URL, status, timing) |
| \`puppeteer-network-log/\` | Detailed request/response JSON files |
| \`puppeteer-cookies/\` | Cookies per domain |

### Reading the Logs

After calling \`/dump\`, read the log files:

\`\`\`bash
# Read console logs
cat puppeteer-console.log

# Read network summary
cat puppeteer-network.log

# List detailed network logs
ls puppeteer-network-log/
\`\`\`

### Starting the Monitor

The monitor must be running to capture logs. See README for setup instructions.
`;

const CLAUDE_MD_MARKER = '## Browser Debugging (puppeteer-monitor)';

const AGENTS_MD_SECTION = `
## Browser Debugging (puppeteer-monitor)

This project has puppeteer-monitor for browser console and network debugging.

### Get Browser Logs

\`\`\`bash
# Trigger dump (requires monitor running)
curl -s http://127.0.0.1:60001/dump

# Check status
curl -s http://127.0.0.1:60001/status
\`\`\`

### Log Files

- \`puppeteer-console.log\` - Browser console output
- \`puppeteer-network.log\` - Network requests summary
- \`puppeteer-network-log/\` - Detailed request/response JSON
- \`puppeteer-cookies/\` - Cookies per domain

### Read Logs

\`\`\`bash
cat puppeteer-console.log
cat puppeteer-network.log
\`\`\`
`;

const AGENTS_MD_MARKER = '## Browser Debugging (puppeteer-monitor)';

function findHostPackageJson() {
  const candidates = [];

  if (process.env.INIT_CWD) {
    candidates.push(process.env.INIT_CWD);
  }
  if (process.env.npm_config_local_prefix) {
    candidates.push(process.env.npm_config_local_prefix);
  }
  if (process.env.PROJECT_CWD) {
    candidates.push(process.env.PROJECT_CWD);
  }

  for (const dir of candidates) {
    if (!dir) continue;
    const packageJsonPath = path.join(dir, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        if (pkg.name !== 'puppeteer-monitor') {
          return packageJsonPath;
        }
      } catch {
        // Continue
      }
    }
  }

  let dir = path.dirname(__dirname);
  for (let i = 0; i < 10; i++) {
    dir = path.dirname(dir);
    const packageJsonPath = path.join(dir, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        if (pkg.name !== 'puppeteer-monitor') {
          return packageJsonPath;
        }
      } catch {
        // Continue
      }
    }
  }

  return null;
}

function addScriptToPackageJson(hostPackageJsonPath) {
  try {
    const content = fs.readFileSync(hostPackageJsonPath, 'utf8');
    const packageJson = JSON.parse(content);
    packageJson.scripts = packageJson.scripts || {};

    if (!packageJson.scripts[SCRIPT_NAME]) {
      packageJson.scripts[SCRIPT_NAME] = SCRIPT_COMMAND;
      fs.writeFileSync(hostPackageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
      console.log(`[puppeteer-monitor] Added '${SCRIPT_NAME}' script`);
    }
  } catch (err) {
    console.warn('[puppeteer-monitor] Could not update package.json:', err.message);
  }
}

function addClaudeMdInstructions(hostDir) {
  const claudeDir = path.join(hostDir, '.claude');
  const claudeMdPath = path.join(claudeDir, 'CLAUDE.md');

  try {
    // Only add to existing file, don't create new one
    if (!fs.existsSync(claudeMdPath)) {
      return;
    }

    const content = fs.readFileSync(claudeMdPath, 'utf8');
    if (content.includes(CLAUDE_MD_MARKER)) {
      // Already has puppeteer-monitor section
      return;
    }

    // Append section to existing file
    fs.appendFileSync(claudeMdPath, '\n' + CLAUDE_MD_SECTION);
    console.log('[puppeteer-monitor] Added browser debugging instructions to .claude/CLAUDE.md');
  } catch (err) {
    // Silently ignore errors (might not have write permission)
  }
}

function addAgentsMdInstructions(hostDir) {
  const agentsMdPath = path.join(hostDir, 'agents.md');

  try {
    // Only add to existing file, don't create new one
    if (!fs.existsSync(agentsMdPath)) {
      return;
    }

    const content = fs.readFileSync(agentsMdPath, 'utf8');
    if (content.includes(AGENTS_MD_MARKER)) {
      // Already has puppeteer-monitor section
      return;
    }

    // Append section to existing file
    fs.appendFileSync(agentsMdPath, '\n' + AGENTS_MD_SECTION);
    console.log('[puppeteer-monitor] Added browser debugging instructions to agents.md');
  } catch (err) {
    // Silently ignore errors (might not have write permission)
  }
}

function printUsageInstructions(hostDir) {
  // Detect if running in WSL - show Open mode hint
  try {
    const release = fs.readFileSync('/proc/version', 'utf8').toLowerCase();
    if (release.includes('microsoft') || release.includes('wsl')) {
      console.log('');
      console.log('[puppeteer-monitor] WSL: Run `pnpm browsermonitor --open` to launch Chrome on Windows.');
      console.log('');
    }
  } catch {
    // Not WSL, skip
  }
}

// Main
try {
  const hostPackageJsonPath = findHostPackageJson();

  if (!hostPackageJsonPath) {
    console.log('[puppeteer-monitor] Run "npx puppeteer-monitor-init" to complete setup');
    process.exit(0);
  }

  const hostDir = path.dirname(hostPackageJsonPath);
  addScriptToPackageJson(hostPackageJsonPath);
  addClaudeMdInstructions(hostDir);
  addAgentsMdInstructions(hostDir);
  printUsageInstructions(hostDir);
} catch {
  process.exit(0);
}
